import { afterEach, expect, it } from 'vitest';
import { parseHTML } from '../../src/vdom/create';
import { createHTMLContext, expectHistoryUnchanged } from '../helpers/html.context';

afterEach(() => {
  document.body.replaceChildren();
});

it('HTML-02: 중첩 HTML을 독립된 임시 DOM으로 파싱하고 실제 화면을 유지한다', () => {
  const context = createHTMLContext();
  const { actualRoot } = context.elements;
  const existingParagraph = actualRoot.firstChild;

  const parsedRoot = parseHTML('<section class="box"><p>A</p></section><span>B</span>');

  expect(parsedRoot).toBeInstanceOf(DocumentFragment);
  expect(parsedRoot.childNodes).toHaveLength(2);
  const section = parsedRoot.firstElementChild;
  const span = parsedRoot.lastElementChild;
  expect(section?.tagName).toBe('SECTION');
  expect(section?.getAttribute('class')).toBe('box');
  expect(section?.childNodes).toHaveLength(1);
  expect(section?.firstElementChild?.tagName).toBe('P');
  expect(section?.firstElementChild?.textContent).toBe('A');
  expect(span?.tagName).toBe('SPAN');
  expect(span?.textContent).toBe('B');
  expect(section?.isConnected).toBe(false);
  expect(span?.isConnected).toBe(false);
  expect(section?.firstChild).not.toBe(existingParagraph);
  expect(actualRoot.innerHTML).toBe('<p>기존</p>');
  expect(actualRoot.firstChild).toBe(existingParagraph);
  expectHistoryUnchanged(context);
});
