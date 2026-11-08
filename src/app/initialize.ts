import { createEmptyVDOM } from '../vdom/create';
import type { DiffCommand, VRoot } from '../vdom/types';
import type { AppElements } from './init';

// 초기화가 사용하는 최소 계약. History 전체 인터페이스는 별도다.
export interface InitializationHistory {
  set(vdom: VRoot, html: string): void;
  get(): VRoot;
}

export interface InitializerDependencies {
  parseHTML(html: string): DocumentFragment;
  createSnapshot(parsedRoot: ParentNode): VRoot;
  diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[];
  // 연결용 호출 형태이며 반환값은 사용하지 않는다. Patch 최종 계약은 pending이다.
  applyPatch(prevRoot: VRoot, nextRoot: VRoot, changes: DiffCommand[]): void;
}

export function createInitializer(
  elements: AppElements,
  history: InitializationHistory,
  dependencies: InitializerDependencies
): (sampleHTML: string) => void {
  return function initializeDOM(sampleHTML: string): void {
    const emptyVDOM = createEmptyVDOM(elements.actualRoot);
    const parsedRoot = dependencies.parseHTML(sampleHTML);
    const sampleVDOM = dependencies.createSnapshot(parsedRoot);
    const changes = dependencies.diff(emptyVDOM, sampleVDOM);

    dependencies.applyPatch(emptyVDOM, sampleVDOM, changes);
    elements.editor.value = sampleHTML;
    history.set(sampleVDOM, sampleHTML);
  };
}
