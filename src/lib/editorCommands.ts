// ─────────────────────────────────────────────────────────────────────────────
// HyperDrive — Global Editor Command Bus
// MenuBar → Custom DOM Events → EditorPane (CodeMirror)
// ─────────────────────────────────────────────────────────────────────────────

export const EDITOR_COMMANDS = {
  UNDO:              'undo',
  REDO:              'redo',
  FIND:              'find',
  REPLACE:           'replace',
  TOGGLE_COMMENT:    'toggleComment',
  ADD_CURSOR_ABOVE:  'addCursorAbove',
  ADD_CURSOR_BELOW:  'addCursorBelow',
  COPY_LINE_UP:      'copyLineUp',
  COPY_LINE_DOWN:    'copyLineDown',
  GO_TO_LINE:        'goToLine',
  FORMAT_DOCUMENT:   'formatDocument',
  SAVE:              'save',
  RUN_CODE:          'runCode',
  SELECT_ALL:        'selectAll',
  FOLD_ALL:          'foldAll',
  UNFOLD_ALL:        'unfoldAll',
} as const;

export type EditorCommand = typeof EDITOR_COMMANDS[keyof typeof EDITOR_COMMANDS];

export interface EditorCommandEvent {
  command: EditorCommand;
  payload?: any;
}

/** Dispatch a command to the currently focused editor pane */
export const dispatchEditorCommand = (command: EditorCommand, payload?: any): void => {
  window.dispatchEvent(
    new CustomEvent<EditorCommandEvent>('hyperdrive:editor-command', {
      detail: { command, payload },
      bubbles: false,
    })
  );
};

/** Open Command Palette */
export const openCommandPalette = (): void => {
  window.dispatchEvent(new CustomEvent('hyperdrive:open-command-palette'));
};

/** Open Go-to-Line Dialog */
export const openGoToLine = (): void => {
  window.dispatchEvent(new CustomEvent('hyperdrive:open-goto-line'));
};

/** Open Go-to-File (Quick Open) */
export const openGoToFile = (): void => {
  window.dispatchEvent(new CustomEvent('hyperdrive:open-goto-file'));
};
