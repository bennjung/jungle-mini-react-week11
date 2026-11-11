/**
 * 입력 값이 바뀔 때 선택 영역을 새 문자열의 대응 위치로 옮긴다.
 *
 * - 값은 UTF-16 오프셋으로 주고받지만 대응 단위는 사용자 표시 문자(grapheme)다.
 * - 공통 앞·뒤를 고정하고 가운데만 정렬한다. 정렬은 편집 수 최소 → 유지 문자 최대
 *   → 대응 위치 이동 최소 순으로 고르고, 완전히 같은 후보는 대각선 → 삭제 → 삽입 순으로 둔다.
 * - 연속한 비대응 구간은 하나의 치환 구간으로 합쳐 상대 위치로 대응한다.
 *   삽입 경계는 삽입 문자 앞, 삭제 구간은 남은 경계로 대응한다.
 * - 같은 길이여도 항등을 강제하지 않는다. 공백·대소문자 같은 문자 종류 예외도 없다.
 *
 * 자동 보정은 편집 의도를 추정하는 것이며 원래 의도를 복원한다고 보장하지 않는다.
 */

export type SelectionRange = {
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none';
};

type GraphemeText = {
  segments: readonly string[];
  /** 각 표시 문자 경계의 UTF-16 오프셋. 길이는 표시 문자 수 + 1이다. */
  boundaries: readonly number[];
};

/** 공통 앞·뒤로 남겨 둔 표시 문자 수. */
type UnchangedEdges = {
  prefix: number;
  suffix: number;
};

type AlignmentDirection = 0 | 1 | 2;

const DIAGONAL: AlignmentDirection = 0;
const DELETE: AlignmentDirection = 1;
const INSERT: AlignmentDirection = 2;

/** 중간 정렬표의 잠정 내부 방어값. 공개 계약이 아니며 측정으로 확정하지 않았다. */
const MAX_ALIGNMENT_CELLS = 40_000;

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme'
});

/**
 * 변경 전 실제 문자열 → 변경 후 실제 문자열 사이에서 선택 영역을 대응시킨다.
 * start·end에 같은 대응을 각각 적용하고, 입력 순서와 direction은 그대로 둔다.
 */
export function mapSelection(
  previousValue: string,
  nextValue: string,
  selection: SelectionRange
): SelectionRange {
  const previous = splitGraphemes(previousValue);
  const next = splitGraphemes(nextValue);
  const edges = findUnchangedEdges(previous.segments, next.segments);
  const middleBoundaries = alignChangedText(previous, next, edges);

  return {
    start: mapOffset(previous, next, edges, middleBoundaries, selection.start),
    end: mapOffset(previous, next, edges, middleBoundaries, selection.end),
    direction: selection.direction
  };
}

/**
 * 값의 양 끝에서 공통으로 유지되는 표시 문자 수를 찾는다.
 * 접두를 먼저 소비하고, 남은 범위에서만 접미를 센다.
 */
function findUnchangedEdges(
  previousSegments: readonly string[],
  nextSegments: readonly string[]
): UnchangedEdges {
  const limit = Math.min(previousSegments.length, nextSegments.length);

  let prefix = 0;
  while (prefix < limit && previousSegments[prefix] === nextSegments[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < limit - prefix &&
    previousSegments[previousSegments.length - 1 - suffix] ===
      nextSegments[nextSegments.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return { prefix, suffix };
}

/**
 * 공통 앞·뒤를 제외한 가운데 구간의 이전 경계 → 다음 경계 대응표를 만든다.
 * 정렬표가 상한을 넘으면 가운데 전체를 하나의 치환 구간으로 처리한다.
 */
function alignChangedText(
  previous: GraphemeText,
  next: GraphemeText,
  edges: UnchangedEdges
): number[] {
  const previousMiddle = previous.segments.slice(
    edges.prefix,
    previous.segments.length - edges.suffix
  );
  const nextMiddle = next.segments.slice(
    edges.prefix,
    next.segments.length - edges.suffix
  );
  const previousLength = previousMiddle.length;
  const nextLength = nextMiddle.length;

  if (
    previousLength === 0 ||
    nextLength === 0 ||
    (previousLength + 1) * (nextLength + 1) > MAX_ALIGNMENT_CELLS
  ) {
    return mapAsSingleReplacement(previousLength, nextLength);
  }

  return mapWithAlignmentTable(previousMiddle, nextMiddle);
}

/**
 * 가운데 구간을 하나의 치환 구간으로 보고 상대 위치를 비례 대응한다.
 * 이전 길이가 0이면 삽입 경계이므로 다음 구간의 시작(삽입 문자 앞)에 둔다.
 */
function mapAsSingleReplacement(
  previousLength: number,
  nextLength: number
): number[] {
  const boundaries = new Array<number>(previousLength + 1).fill(0);

  for (let boundary = 0; boundary <= previousLength; boundary += 1) {
    boundaries[boundary] = proportionalOffset(
      boundary,
      previousLength,
      nextLength
    );
  }

  return boundaries;
}

/**
 * 가운데 구간을 문자 단위 정렬표로 비교해 이전 경계 → 다음 경계 대응표를 만든다.
 * 점수는 (편집 수, -유지 문자 수, 대응 위치 이동량)의 사전식 최소다.
 * 대응 위치 이동량은 유지된 문자의 가운데 구간 내 1-based 위치 차이 합이다.
 */
function mapWithAlignmentTable(
  previousSegments: readonly string[],
  nextSegments: readonly string[]
): number[] {
  const previousLength = previousSegments.length;
  const nextLength = nextSegments.length;
  const width = nextLength + 1;
  const cellCount = (previousLength + 1) * width;

  // 표 전체를 객체 배열로 만들지 않고 숫자 배열 네 개로만 유지한다.
  const costs = new Uint32Array(cellCount);
  const retained = new Uint32Array(cellCount);
  const movements = new Uint32Array(cellCount);
  const directions = new Uint8Array(cellCount);

  for (
    let previousIndex = 1;
    previousIndex <= previousLength;
    previousIndex += 1
  ) {
    const cell = previousIndex * width;
    costs[cell] = previousIndex;
    directions[cell] = DELETE;
  }

  for (let nextIndex = 1; nextIndex <= nextLength; nextIndex += 1) {
    costs[nextIndex] = nextIndex;
    directions[nextIndex] = INSERT;
  }

  for (
    let previousIndex = 1;
    previousIndex <= previousLength;
    previousIndex += 1
  ) {
    for (let nextIndex = 1; nextIndex <= nextLength; nextIndex += 1) {
      const cell = previousIndex * width + nextIndex;
      const diagonal = cell - width - 1;
      const isMatch =
        previousSegments[previousIndex - 1] === nextSegments[nextIndex - 1];

      let bestCost = costs[diagonal]! + (isMatch ? 0 : 1);
      let bestRetained = retained[diagonal]! + (isMatch ? 1 : 0);
      let bestMovement =
        movements[diagonal]! +
        (isMatch ? Math.abs(previousIndex - nextIndex) : 0);
      let bestDirection: AlignmentDirection = DIAGONAL;

      const deleteCell = cell - width;
      const deleteCost = costs[deleteCell]! + 1;
      const deleteRetained = retained[deleteCell]!;
      const deleteMovement = movements[deleteCell]!;
      if (
        isBetterAlignment(
          deleteCost,
          deleteRetained,
          deleteMovement,
          bestCost,
          bestRetained,
          bestMovement
        )
      ) {
        bestCost = deleteCost;
        bestRetained = deleteRetained;
        bestMovement = deleteMovement;
        bestDirection = DELETE;
      }

      const insertCell = cell - 1;
      const insertCost = costs[insertCell]! + 1;
      const insertRetained = retained[insertCell]!;
      const insertMovement = movements[insertCell]!;
      if (
        isBetterAlignment(
          insertCost,
          insertRetained,
          insertMovement,
          bestCost,
          bestRetained,
          bestMovement
        )
      ) {
        bestCost = insertCost;
        bestRetained = insertRetained;
        bestMovement = insertMovement;
        bestDirection = INSERT;
      }

      costs[cell] = bestCost;
      retained[cell] = bestRetained;
      movements[cell] = bestMovement;
      directions[cell] = bestDirection;
    }
  }

  const path = new Uint8Array(previousLength + nextLength);
  let previousIndex = previousLength;
  let nextIndex = nextLength;
  let pathLength = 0;

  while (previousIndex > 0 || nextIndex > 0) {
    const direction = directions[previousIndex * width + nextIndex]!;
    path[pathLength] = direction;
    pathLength += 1;

    if (direction === DIAGONAL) {
      previousIndex -= 1;
      nextIndex -= 1;
    } else if (direction === DELETE) {
      previousIndex -= 1;
    } else {
      nextIndex -= 1;
    }
  }

  return buildBoundaryMap(
    previousSegments,
    nextSegments,
    path,
    pathLength
  );
}

/**
 * 역추적 경로를 앞에서부터 읽어 이전 경계별 다음 경계를 채운다.
 * 유지 문자 사이의 연속한 비대응 연산은 하나의 치환 구간으로 합친다.
 */
function buildBoundaryMap(
  previousSegments: readonly string[],
  nextSegments: readonly string[],
  path: Uint8Array,
  pathLength: number
): number[] {
  const boundaries = new Array<number>(previousSegments.length + 1).fill(0);
  let runPreviousStart = -1;
  let runNextStart = 0;
  let previousIndex = 0;
  let nextIndex = 0;

  for (let pathIndex = pathLength - 1; pathIndex >= 0; pathIndex -= 1) {
    const direction = path[pathIndex]!;
    const isMatch =
      direction === DIAGONAL &&
      previousSegments[previousIndex] === nextSegments[nextIndex];

    if (isMatch) {
      if (runPreviousStart !== -1) {
        fillReplacementBoundaries(
          boundaries,
          runPreviousStart,
          previousIndex,
          runNextStart,
          nextIndex
        );
        runPreviousStart = -1;
      }

      previousIndex += 1;
      nextIndex += 1;
      boundaries[previousIndex] = nextIndex;
      continue;
    }

    if (runPreviousStart === -1) {
      runPreviousStart = previousIndex;
      runNextStart = nextIndex;
    }

    if (direction === DIAGONAL) {
      previousIndex += 1;
      nextIndex += 1;
    } else if (direction === DELETE) {
      previousIndex += 1;
    } else {
      nextIndex += 1;
    }
  }

  if (runPreviousStart !== -1) {
    fillReplacementBoundaries(
      boundaries,
      runPreviousStart,
      previousIndex,
      runNextStart,
      nextIndex
    );
  }

  return boundaries;
}

/**
 * 치환 구간 안의 이전 경계를 다음 구간의 비례 경계로 채운다.
 * 구간 시작 경계는 앞선 유지 문자가 이미 정했으므로 건드리지 않는다.
 * 삽입만 있는 구간은 이전 경계를 소비하지 않으므로 채울 경계가 없다.
 */
function fillReplacementBoundaries(
  boundaries: number[],
  previousStart: number,
  previousEnd: number,
  nextStart: number,
  nextEnd: number
): void {
  const previousLength = previousEnd - previousStart;
  if (previousLength === 0) return;

  const nextLength = nextEnd - nextStart;
  for (
    let boundary = previousStart + 1;
    boundary <= previousEnd;
    boundary += 1
  ) {
    boundaries[boundary] =
      nextStart +
      proportionalOffset(boundary - previousStart, previousLength, nextLength);
  }
}

/** 이전 구간의 상대 위치를 다음 구간의 경계로 옮긴다. 반올림 방식은 내부 기본값이다. */
function proportionalOffset(
  offset: number,
  previousLength: number,
  nextLength: number
): number {
  if (previousLength === 0) return 0;
  return Math.round((offset * nextLength) / previousLength);
}

/** 편집 수가 적고, 유지 문자가 많고, 대응 위치 이동이 적은 후보를 고른다. */
function isBetterAlignment(
  cost: number,
  retained: number,
  movement: number,
  bestCost: number,
  bestRetained: number,
  bestMovement: number
): boolean {
  if (cost !== bestCost) return cost < bestCost;
  if (retained !== bestRetained) return retained > bestRetained;
  return movement < bestMovement;
}

/**
 * 선택 오프셋을 공통 앞·뒤와 가운데 대응표를 거쳐 새 값의 UTF-16 오프셋으로 옮긴다.
 * 표시 문자 내부 오프셋은 그 표시 문자의 시작 경계로 맞춘다.
 */
function mapOffset(
  previous: GraphemeText,
  next: GraphemeText,
  edges: UnchangedEdges,
  middleBoundaries: readonly number[],
  offset: number
): number {
  const previousBoundary = toGraphemeBoundary(previous.boundaries, offset);
  const previousCount = previous.segments.length;
  const nextCount = next.segments.length;

  let nextBoundary: number;
  if (previousBoundary <= edges.prefix) {
    nextBoundary = previousBoundary;
  } else if (previousBoundary <= previousCount - edges.suffix) {
    // 가운데 끝 경계까지는 정렬표를 쓴다. 끝에 붙은 삽입도 삽입 문자 앞으로 간다.
    nextBoundary =
      edges.prefix +
      (middleBoundaries[previousBoundary - edges.prefix] ?? 0);
  } else {
    nextBoundary = nextCount - (previousCount - previousBoundary);
  }

  return toUtf16Offset(next.boundaries, nextBoundary);
}

/**
 * 문자열을 표시 문자 단위로 나누고 각 경계의 UTF-16 오프셋을 기록한다.
 * 분절은 입력 전체를 한 번 훑으므로 최악의 경우 O(문자열 길이)다.
 */
function splitGraphemes(value: string): GraphemeText {
  const segments: string[] = [];
  const boundaries: number[] = [0];

  for (const { segment, index } of graphemeSegmenter.segment(value)) {
    segments.push(segment);
    boundaries.push(index + segment.length);
  }

  return { segments, boundaries };
}

/**
 * UTF-16 오프셋을 그 오프셋을 포함하는 표시 문자의 시작 경계로 바꾼다.
 * 서로게이트 페어·결합 문자 내부는 분리하지 않고 시작 쪽으로 맞춘다.
 */
function toGraphemeBoundary(
  boundaries: readonly number[],
  offset: number
): number {
  const textLength = boundaries[boundaries.length - 1] ?? 0;
  const clamped = Number.isFinite(offset)
    ? Math.min(Math.max(Math.trunc(offset), 0), textLength)
    : 0;

  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((boundaries[middle] ?? textLength) <= clamped) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

/** 표시 문자 경계 인덱스를 UTF-16 오프셋으로 바꾼다. */
function toUtf16Offset(
  boundaries: readonly number[],
  boundaryIndex: number
): number {
  const lastIndex = boundaries.length - 1;
  const clamped = Math.min(Math.max(boundaryIndex, 0), lastIndex);
  return boundaries[clamped] ?? 0;
}
