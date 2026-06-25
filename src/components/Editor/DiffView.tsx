import { onMount, onCleanup } from "solid-js";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { oneDark } from "@codemirror/theme-one-dark";

interface DiffViewProps {
  originalContent: string;
  modifiedContent: string;
}

export default function DiffView(props: DiffViewProps) {
  let diffParentRef: HTMLDivElement | undefined;
  let mergeView: any;

  onMount(() => {
    if (!diffParentRef) return;

    mergeView = new MergeView({
      a: {
        doc: props.originalContent,
        extensions: [EditorState.readOnly.of(true), oneDark]
      },
      b: {
        doc: props.modifiedContent,
        extensions: [oneDark]
      },
      parent: diffParentRef,
      orientation: "a-b" // side-by-side
    });
  });

  onCleanup(() => {
    if (mergeView) {
      // Clean up DOM if required
    }
  });

  return (
    <div style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;">
      <div 
        style="padding: 6px 12px; background: var(--bg-panel); border-bottom: 1px solid var(--border-subtle); font-size: var(--font-size-xs); color: var(--text-secondary); display: flex; justify-content: space-between;"
      >
        <span>Original (Left)</span>
        <span>Modified (Right)</span>
      </div>
      <div 
        ref={diffParentRef} 
        style="flex: 1; overflow: auto; background: var(--bg-base);" 
        class="cm-merge-parent"
      ></div>
    </div>
  );
}
