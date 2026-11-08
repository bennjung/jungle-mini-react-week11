export function readEditorHTML(editor: HTMLTextAreaElement): string {
  return editor.value;
}

export function writeEditorHTML(editor: HTMLTextAreaElement, html: string): void {
  editor.value = html;
}
