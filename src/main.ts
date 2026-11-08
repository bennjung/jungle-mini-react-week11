import { createHandlers } from './app/handlers';
import { createHistory } from './app/history';
import { init } from './app/init';
import { getSampleHTML } from './sample';
import { createSnapshot, parseHTML } from './vdom/create';
import { diff } from './vdom/diff';
import { applyPatch } from './vdom/patch';

const app = init({
  parseHTML,
  createSnapshot,
  diff,
  applyPatch,
  createHistory,
  getSampleHTML,
  createHandlers
});

app.elements.editor.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;

  event.preventDefault();
  const start = app.elements.editor.selectionStart;
  const end = app.elements.editor.selectionEnd;
  app.elements.editor.value = `${app.elements.editor.value.slice(0, start)}  ${app.elements.editor.value.slice(end)}`;
  app.elements.editor.selectionStart = app.elements.editor.selectionEnd = start + 2;
});
