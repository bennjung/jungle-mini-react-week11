import { afterEach, expect, it } from 'vitest';
import { readEditorHTML } from '../../src/app/editor';
import { createHTMLContext, expectHistoryUnchanged } from '../helpers/html.context';

afterEach(() => {
  document.body.replaceChildren();
});

it('HTML-01: 편집기 요소에서 줄바꿈·들여쓰기를 포함한 현재 HTML 원문을 그대로 읽는다', () => {
  const context = createHTMLContext();
  const { editor, actualRoot } = context.elements;
  editor.textContent = '편집기의 기본 내용';
  editor.value = '<div>\n  <p>A</p>\n</div>';
  const existingParagraph = actualRoot.firstChild;

  const html = readEditorHTML(editor);

  expect(html).toBe('<div>\n  <p>A</p>\n</div>');
  expect(editor.value).toBe('<div>\n  <p>A</p>\n</div>');
  expect(editor.textContent).toBe('편집기의 기본 내용');
  expect(actualRoot.innerHTML).toBe('<p>기존</p>');
  expect(actualRoot.firstChild).toBe(existingParagraph);
  expectHistoryUnchanged(context);
});
