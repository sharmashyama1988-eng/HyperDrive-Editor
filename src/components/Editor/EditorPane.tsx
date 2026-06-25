import { onMount, onCleanup, createEffect } from "solid-js";
import { editorStore, OpenTab } from "@store/editorStore";
import { settingsStore } from "@store/settingsStore";
import { EditorState, EditorSelection, Compartment } from "@codemirror/state";
import {
  EditorView, keymap, drawSelection, rectangularSelection,
  crosshairCursor, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultKeymap, history, historyKeymap,
  undo, redo,
  toggleComment,
  copyLineUp, copyLineDown,
  selectAll,
} from "@codemirror/commands";
import {
  indentOnInput, syntaxHighlighting, defaultHighlightStyle,
  bracketMatching, foldGutter, foldKeymap, syntaxTree
} from "@codemirror/language";
import {
  autocompletion, completionKeymap,
  closeBrackets, closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  searchKeymap, highlightSelectionMatches,
  openSearchPanel,
} from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { PieceTable } from "@lib/pieceTable";
import { EDITOR_COMMANDS, EditorCommandEvent } from "@lib/editorCommands";
import { linter, Diagnostic } from "@codemirror/lint";

// Language support imports
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { sql } from "@codemirror/lang-sql";

// Manual multi-cursor implementations (not exported by CM6 stdlib)
const insertCursorAbove = (view: EditorView): boolean => {
  const { state } = view;
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  if (line.number <= 1) return false;
  const prevLine = state.doc.line(line.number - 1);
  const col = main.head - line.from;
  const newPos = Math.min(prevLine.from + col, prevLine.to);
  const ranges = [...state.selection.ranges, EditorSelection.cursor(newPos)];
  view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
  return true;
};

const insertCursorBelow = (view: EditorView): boolean => {
  const { state } = view;
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  if (line.number >= state.doc.lines) return false;
  const nextLine = state.doc.line(line.number + 1);
  const col = main.head - line.from;
  const newPos = Math.min(nextLine.from + col, nextLine.to);
  const ranges = [...state.selection.ranges, EditorSelection.cursor(newPos)];
  view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
  return true;
};

interface EditorPaneProps {
  tab: OpenTab;
  splitId: string;
}

// Compartment for hot-swappable line numbers and languages
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment    = new Compartment();
const languageCompartment    = new Compartment();

// Helper to resolve CodeMirror language extensions
const getLanguageExtension = (lang: string) => {
  switch (lang) {
    case "javascript": return javascript();
    case "typescript": return javascript({ typescript: true });
    case "python":     return python();
    case "html":       return html();
    case "css":        return css();
    case "json":       return json();
    case "markdown":   return markdown();
    case "rust":       return rust();
    case "java":       return java();
    case "cpp":        return cpp();
    case "c":          return cpp();
    case "sql":        return sql();
    default:           return [];
  }
};

// Helper to provide descriptive solutions and actions for common syntax errors
const getLanguageSolution = (
  lang: string,
  errorText: string,
  lineText: string,
  from: number,
  to: number
) => {
  let explanation = "Syntax error: unexpected token or invalid syntax.";
  const actions: any[] = [];

  // Default quick fix to remove the unexpected token/invalid character
  actions.push({
    name: "Remove unexpected token",
    apply(view: EditorView, f: number, t: number) {
      view.dispatch({
        changes: { from: f, to: t, insert: "" }
      });
    }
  });

  const trimmed = lineText.trim();
  if (lang === "python") {
    const isBlockKeyword = (
      trimmed.startsWith("if ") || trimmed.startsWith("elif ") || trimmed.startsWith("else") ||
      trimmed.startsWith("def ") || trimmed.startsWith("class ") || trimmed.startsWith("for ") ||
      trimmed.startsWith("while ") || trimmed.startsWith("try") || trimmed.startsWith("except")
    );
    if (isBlockKeyword && !trimmed.endsWith(":")) {
      explanation = "Python syntax requires a colon ':' at the end of block statements.";
      actions.unshift({
        name: "Add missing colon ':'",
        apply(view: EditorView) {
          const lineObj = view.state.doc.lineAt(from);
          view.dispatch({
            changes: { from: lineObj.to, to: lineObj.to, insert: ":" }
          });
        }
      });
    } else if (trimmed.includes("=") && !trimmed.includes("==") && (trimmed.startsWith("if ") || trimmed.startsWith("elif ") || trimmed.startsWith("while "))) {
      explanation = "Use '==' for comparison, not '=' (which is for assignment).";
      actions.unshift({
        name: "Replace '=' with '=='",
        apply(view: EditorView) {
          const idx = lineText.indexOf("=");
          const lineObj = view.state.doc.lineAt(from);
          view.dispatch({
            changes: { from: lineObj.from + idx, to: lineObj.from + idx + 1, insert: "==" }
          });
        }
      });
    }
  } else if (lang === "javascript" || lang === "typescript") {
    if ((trimmed.startsWith("const ") || trimmed.startsWith("let ")) && !trimmed.includes("=") && !trimmed.endsWith(";")) {
      explanation = "Variables declared with const/let must be initialized or end with a semicolon.";
    } else if (trimmed.startsWith("if") && !trimmed.includes("(") && !trimmed.includes(")")) {
      explanation = "JavaScript 'if' conditions must be enclosed in parentheses ().";
    }
  }

  return { explanation, actions };
};

interface EditorPaneProps {
  tab: OpenTab;
  splitId: string;
}

export default function EditorPane(props: EditorPaneProps) {
  let editorParentRef: HTMLDivElement | undefined;
  let view: EditorView | undefined;
  let pieceTable: PieceTable | undefined;
  let lastLineNumber = 1;

  const applyAutoFixesForLine = (editorView: EditorView, lineNum: number) => {
    if (lineNum < 1 || lineNum > editorView.state.doc.lines) return;
    const lineObj = editorView.state.doc.line(lineNum);
    const tree = syntaxTree(editorView.state);
    
    let applied = false;
    tree.iterate({
      from: lineObj.from,
      to: lineObj.to,
      enter: (node) => {
        if (applied) return;
        if (node.type.isError || node.name === "Error") {
          const from = node.from;
          const to = node.to;
          const errorText = editorView.state.doc.sliceString(from, to) || "";
          const { actions } = getLanguageSolution(
            props.tab.language,
            errorText,
            lineObj.text,
            from,
            to
          );
          if (actions && actions.length > 0) {
            actions[0].apply(editorView, from, to);
            applied = true;
          }
        }
      }
    });
  };

  // ── Command handler ────────────────────────────────────────────────────────
  const handleEditorCommand = (e: Event) => {
    if (!view) return;
    const { command, payload } = (e as CustomEvent<EditorCommandEvent>).detail;

    switch (command) {
      case EDITOR_COMMANDS.UNDO:             undo(view);             break;
      case EDITOR_COMMANDS.REDO:             redo(view);             break;
      case EDITOR_COMMANDS.FIND:             openSearchPanel(view);  break;
      case EDITOR_COMMANDS.REPLACE:          openSearchPanel(view);  break;
      case EDITOR_COMMANDS.TOGGLE_COMMENT:   toggleComment(view);    break;
      case EDITOR_COMMANDS.COPY_LINE_UP:     copyLineUp(view);       break;
      case EDITOR_COMMANDS.COPY_LINE_DOWN:   copyLineDown(view);     break;
      case EDITOR_COMMANDS.SELECT_ALL:       selectAll(view);        break;
      case EDITOR_COMMANDS.ADD_CURSOR_ABOVE: insertCursorAbove(view); break;
      case EDITOR_COMMANDS.ADD_CURSOR_BELOW: insertCursorBelow(view); break;
      case EDITOR_COMMANDS.GO_TO_LINE: {
        const lineNum = typeof payload === "number" ? payload : parseInt(payload, 10);
        if (!isNaN(lineNum)) {
          const doc   = view.state.doc;
          const line  = doc.line(Math.max(1, Math.min(lineNum, doc.lines)));
          view.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true,
            effects: EditorView.scrollIntoView(line.from, { y: "center" }),
          });
          view.focus();
        }
        break;
      }
      default: break;
    }
  };

  onMount(() => {
    if (!editorParentRef) return;

    pieceTable = new PieceTable(props.tab.content);
    const settings = settingsStore.settings;

    const state = EditorState.create({
      doc: pieceTable.getVal(),
      extensions: [
        lineNumbersCompartment.of(
          settings["editor.lineNumbers"] !== "off" ? lineNumbers() : []
        ),
        wordWrapCompartment.of(
          settings["editor.wordWrap"] === "on"
            ? EditorView.lineWrapping
            : []
        ),
        languageCompartment.of(getLanguageExtension(props.tab.language)),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        rectangularSelection(),
        crosshairCursor(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        foldGutter(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        linter((view) => {
          const diagnostics: Diagnostic[] = [];
          const tree = syntaxTree(view.state);
          
          tree.iterate({
            enter: (node) => {
              if (node.type.isError || node.name === "Error") {
                const from = node.from;
                const to = node.to;
                const lineObj = view.state.doc.lineAt(from);
                const lineText = lineObj.text;
                const errorText = view.state.doc.sliceString(from, to) || "";
                
                const { explanation, actions } = getLanguageSolution(
                  props.tab.language,
                  errorText,
                  lineText,
                  from,
                  to
                );

                diagnostics.push({
                  from,
                  to: to === from ? to + 1 : to,
                  severity: "error",
                  message: explanation,
                  actions: actions
                });
              }
            }
          });

          // Sync diagnostics with SolidJS editorStore
          const items = diagnostics.map((d, index) => {
            const lineObj = view.state.doc.lineAt(d.from);
            return {
              id: `${props.tab.path}-${d.from}-${index}`,
              filePath: props.tab.path,
              fileName: props.tab.name,
              line: lineObj.number,
              col: d.from - lineObj.from + 1,
              message: d.message,
              severity: "error" as const,
              source: "syntax"
            };
          });
          
          setTimeout(() => {
            editorStore.setDiagnosticsForFile(props.tab.path, items);
          }, 0);

          return diagnostics;
        }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...foldKeymap,
          ...searchKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const currentContent = update.state.doc.toString();
            update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              const insertedText = inserted.toString();
              const deleteLength = toA - fromA;
              if (deleteLength > 0) pieceTable?.delete(fromA, deleteLength);
              if (insertedText.length > 0) pieceTable?.insert(fromA, insertedText);
            });
            editorStore.updateTabContent(props.tab.id, currentContent);
            editorStore.setTabDirty(props.tab.id, true);
          }
          if (update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            const currentLine = line.number;
            if (currentLine !== lastLineNumber) {
              if (view && settingsStore.settings["editor.autoFixOnType"]) {
                applyAutoFixesForLine(view, lastLineNumber);
              }
              lastLineNumber = currentLine;
            }
            editorStore.setCursor(line.number, head - line.from + 1);
          }
        }),
      ],
    });

    view = new EditorView({ state, parent: editorParentRef });

    // Listen to global editor commands
    window.addEventListener("hyperdrive:editor-command", handleEditorCommand);
  });

  onCleanup(() => {
    view?.destroy();
    window.removeEventListener("hyperdrive:editor-command", handleEditorCommand);
    editorStore.clearDiagnosticsForFile(props.tab.path);
  });

  // Reactively reconfigure language support extension
  createEffect(() => {
    const lang = props.tab.language;
    if (view) {
      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(lang))
      });
    }
  });

  // Hot-reload content on external changes
  createEffect(() => {
    const ext = props.tab.content;
    if (view && view.state.doc.toString() !== ext) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: ext },
      });
    }
  });

  // Reactively reconfigure word wrap
  createEffect(() => {
    const wrap = settingsStore.settings["editor.wordWrap"];
    if (view) {
      view.dispatch({
        effects: wordWrapCompartment.reconfigure(
          wrap === "on" ? EditorView.lineWrapping : []
        ),
      });
    }
  });

  // Reactively reconfigure line numbers
  createEffect(() => {
    const ln = settingsStore.settings["editor.lineNumbers"];
    if (view) {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          ln !== "off" ? lineNumbers() : []
        ),
      });
    }
  });

  return (
    <div style="display:flex;flex-direction:row;height:100%;width:100%;position:relative;overflow:hidden;">
      <div ref={editorParentRef} style="flex:1;height:100%;overflow:hidden;" class="cm-parent" />
    </div>
  );
}
