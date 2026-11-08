import { afterEach, expect, it } from 'vitest';
import { createSnapshot, parseHTML } from '../../src/vdom/create';
import { createHTMLContext, expectHistoryUnchanged } from '../helpers/html.context';

afterEach(() => {
  document.body.replaceChildren();
});

it('HTML-03: 빈 HTML을 자식 없는 VDOM으로 변환하고 기존 화면·현재 VDOM을 유지한다', () => {
  const context = createHTMLContext();
  const { actualRoot } = context.elements;
  const paragraph = actualRoot.firstChild;
  const text = paragraph?.firstChild ?? null;
  const prevRoot = context.root;
  const prevChildren = prevRoot.childNodes;
  const prevParagraph = prevChildren[0];
  const prevText = prevParagraph?.childNodes[0];

  const nextRoot = createSnapshot(parseHTML(''));

  expect(nextRoot).toEqual({ childNodes: [], dom: null });
  expect(actualRoot.innerHTML).toBe('<p>기존</p>');
  expect(actualRoot.firstChild).toBe(paragraph);
  expect(paragraph?.firstChild).toBe(text);
  expect(prevRoot.dom).toBe(actualRoot);
  expect(prevRoot.childNodes).toBe(prevChildren);
  expect(prevRoot.childNodes).toHaveLength(1);
  expect(prevRoot.childNodes[0]).toBe(prevParagraph);
  expect(prevParagraph?.dom).toBe(paragraph);
  expect(prevParagraph?.tagName).toBe('P');
  expect(prevParagraph?.childNodes).toHaveLength(1);
  expect(prevParagraph?.childNodes[0]).toBe(prevText);
  expect(prevText?.dom).toBe(text);
  expect(prevText?.nodeValue).toBe('기존');
  expectHistoryUnchanged(context);
});
