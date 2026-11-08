import type { VRoot } from '../vdom/types';
import { createInitializer } from './initialize';
import type { InitializationHistory, InitializerDependencies } from './initialize';

export interface AppElements {
  editor: HTMLTextAreaElement;
  actualRoot: HTMLElement;
  patchButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
}

export interface AppHandlers {
  handlePatch(): void;
  handleHistoryMove(direction: -1 | 1): void;
}

export interface InitDependencies extends InitializerDependencies {
  createHistory(): InitializationHistory;
  getSampleHTML(): string;
  createHandlers(elements: AppElements, history: InitializationHistory): AppHandlers;
}

export function getElements(): AppElements {
  const editor = document.querySelector<HTMLTextAreaElement>('#editor');
  const actualRoot = document.querySelector<HTMLElement>('#actual');
  const patchButton = document.querySelector<HTMLButtonElement>('#patch');
  const backButton = document.querySelector<HTMLButtonElement>('#back');
  const forwardButton = document.querySelector<HTMLButtonElement>('#forward');

  if (!editor || !actualRoot || !patchButton || !backButton || !forwardButton) {
    throw new Error(
      '필수 요소를 찾을 수 없습니다: #editor, #actual, #patch, #back, #forward'
    );
  }

  return { editor, actualRoot, patchButton, backButton, forwardButton };
}

export function bindEvents(elements: AppElements, handlers: AppHandlers): void {
  elements.patchButton.addEventListener('click', () => handlers.handlePatch());
  elements.backButton.addEventListener('click', () => handlers.handleHistoryMove(-1));
  elements.forwardButton.addEventListener('click', () => handlers.handleHistoryMove(1));
}

export function init(dependencies?: InitDependencies): { elements: AppElements; root: VRoot } {
  if (!dependencies) {
    throw new Error('초기화 의존 함수가 연결되지 않았습니다. 실제 함수 또는 테스트 대역을 전달하세요.');
  }

  const elements = getElements();
  const history = dependencies.createHistory();
  const sampleHTML = dependencies.getSampleHTML();
  const initializeDOM = createInitializer(elements, history, dependencies);
  initializeDOM(sampleHTML);
  bindEvents(elements, dependencies.createHandlers(elements, history));
  const root = history.get();

  return { elements, root };
}
