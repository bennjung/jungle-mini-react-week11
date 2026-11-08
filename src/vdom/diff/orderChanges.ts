import type { DiffCommand, VNode, VRoot } from '../types';

/** 한 번의 순회로 모으는 명령 메타데이터. */
type CommandMetadata = {
  createdBy: Map<VNode, number>;
  replacementByTarget: Map<VNode, number>;
};

/** 명령 간 선행 관계를 표현하는 인접 리스트와 진입 차수. */
type DependencyGraph = {
  dependents: Array<Set<number>>;
  indegree: number[];
};

/**
 * 입력: 필요한 변경 명령 배열.
 * 출력: 동일한 작업을 실행 가능한 순서로 배치한 배열.
 * 책임: 명령 간 실행 의존성을 처리한다. 잘못된 대응·이동 선택은 고치지 않는다.
 * 명령의 의미적 유효성(예: parent가 remove 대상인지)은 검증하지 않는다.
 * 단, 같은 next VNode를 만드는 명령이 중복되거나 같은 prev VNode를 여러 번 replace하면 오류로 처리한다.
 *
 * 부모·기준 형제가 새 VNode라면 그 노드를 만드는 insert/replace가 먼저 실행되도록 한다.
 * 같은 대상의 move는 replace보다 먼저 실행한다.
 */
export function orderChanges(changes: DiffCommand[]): DiffCommand[] {
  if (changes.length < 2) return [...changes];

  const graph = buildDependencyGraph(changes);
  return stableTopologicalSort(changes, graph);
}

/** 생성·replace 메타데이터를 바탕으로 명령 간 의존성 그래프를 만든다. */
function buildDependencyGraph(changes: DiffCommand[]): DependencyGraph {
  const { createdBy, replacementByTarget } = indexCommandMetadata(changes);
  const graph: DependencyGraph = {
    dependents: changes.map(() => new Set<number>()),
    indegree: new Array<number>(changes.length).fill(0)
  };

  changes.forEach((change, index) => {
    if (change.type === 'insert' || change.type === 'move') {
      addCreatedDependency(change.parent, index, createdBy, graph);
      if (change.before !== null) {
        addCreatedDependency(change.before, index, createdBy, graph);
      }
    }

    if (change.type === 'move') {
      // move.target은 이전 VNode이므로, 먼저 이동한 뒤 그 위치에서 replace가 일어나야 한다.
      const replacement = replacementByTarget.get(change.target);
      if (replacement !== undefined) addDependency(graph, index, replacement);
    }
  });

  return graph;
}

/**
 * 생성 노드와 replace 대상을 한 번의 순회로 인덱싱한다.
 * 정상 Diff에서 한 next VNode를 만드는 명령은 하나이고,
 * 한 prev VNode를 replace하는 명령도 하나다.
 * 같은 next VNode 생성이나 같은 prev VNode replace가 중복되면 구조적 오류로 처리한다.
 */
function indexCommandMetadata(changes: DiffCommand[]): CommandMetadata {
  const createdBy = new Map<VNode, number>();
  const replacementByTarget = new Map<VNode, number>();

  changes.forEach((change, index) => {
    if (change.type === 'insert' || change.type === 'replace') {
      if (createdBy.has(change.node)) {
        throw new Error('orderChanges: duplicate creator for next VNode');
      }
      createdBy.set(change.node, index);
    }
    if (change.type === 'replace') {
      if (replacementByTarget.has(change.target)) {
        throw new Error('orderChanges: duplicate replace target');
      }
      replacementByTarget.set(change.target, index);
    }
  });

  return { createdBy, replacementByTarget };
}

/** target이 생성 명령의 결과라면 그 생성 명령을 target보다 먼저 실행하도록 의존성을 추가한다. */
function addCreatedDependency(
  target: VNode | VRoot,
  index: number,
  createdBy: Map<VNode, number>,
  graph: DependencyGraph
): void {
  if (!isVNode(target)) return;

  const creator = createdBy.get(target);
  if (creator !== undefined) addDependency(graph, creator, index);
}

function isVNode(node: VNode | VRoot): node is VNode {
  return 'nodeType' in node;
}

/** before 명령이 끝나야 after 명령을 실행할 수 있다는 edge를 추가한다. */
function addDependency(graph: DependencyGraph, before: number, after: number): void {
  if (before === after) return;

  const outgoing = graph.dependents[before];
  if (outgoing === undefined || outgoing.has(after)) return;

  outgoing.add(after);
  graph.indegree[after] = (graph.indegree[after] ?? 0) + 1;
}

/**
 * 원래 입력 순서를 최대한 유지하는 위상 정렬.
 * 준비된 명령은 원래 인덱스가 작은 것부터 실행한다.
 */
function stableTopologicalSort(
  changes: DiffCommand[],
  graph: DependencyGraph
): DiffCommand[] {
  const ready: number[] = [];
  graph.indegree.forEach((degree, index) => {
    if (degree === 0) ready.push(index);
  });

  const ordered: DiffCommand[] = [];

  while (ready.length > 0) {
    const index = ready.shift();
    if (index === undefined) break;

    const change = changes[index];
    if (change === undefined) throw new Error('orderChanges: command index out of range');
    ordered.push(change);

    for (const next of graph.dependents[index] ?? []) {
      const degree = (graph.indegree[next] ?? 0) - 1;
      graph.indegree[next] = degree;
      if (degree === 0) insertSorted(ready, next);
    }
  }

  if (ordered.length !== changes.length) {
    throw new Error('orderChanges: circular dependency');
  }

  return ordered;
}

/** ready 배열에 원래 인덱스 순서를 유지하도록 삽입한다. */
function insertSorted(indices: number[], value: number): void {
  let low = 0;
  let high = indices.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const current = indices[middle];

    if (current === undefined || current < value) low = middle + 1;
    else high = middle;
  }

  indices.splice(low, 0, value);
}
