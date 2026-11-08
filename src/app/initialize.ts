import { createEmptyVDOM } from '../vdom/create';
import type { DiffCommand, VRoot } from '../vdom/types';
import type { History } from './history';
import type { AppElements } from './init';

// 초기화가 사용하는 최소 계약. History 전체 인터페이스는 별도다.
export type InitializationHistory = Pick<History, 'get' | 'set'>;

export interface InitializerDependencies {
  parseHTML(html: string): DocumentFragment;
  createSnapshot(parsedRoot: ParentNode): VRoot;
  diff(prevRoot: VRoot, nextRoot: VRoot): DiffCommand[];
  applyPatch(prevRoot: VRoot, nextRoot: VRoot, changes: DiffCommand[]): VRoot;
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

    const completed = dependencies.applyPatch(emptyVDOM, sampleVDOM, changes);
    elements.editor.value = sampleHTML;
    history.set(completed, sampleHTML);
  };
}
