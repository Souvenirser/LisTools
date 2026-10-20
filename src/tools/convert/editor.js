import { EditorState } from '@codemirror/state';

export function createTextState({doc='',extensions=[]}={}) {
  // CR is a retained character; only LF separates editor lines. This preserves
  // CRLF and mixed endings in doc.toString(), including pasted text.
  return EditorState.create({doc,extensions:[EditorState.lineSeparator.of('\n'),extensions]});
}
