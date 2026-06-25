import { onMount, onCleanup } from "solid-js";
import { Terminal as Xterm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { editorStore } from "@store/editorStore";
import "xterm/css/xterm.css";

export default function Terminal() {
  let terminalParentRef: HTMLDivElement | undefined;
  let term: Xterm | undefined;
  let fitAddon: FitAddon | undefined;

  onMount(() => {
    if (!terminalParentRef) return;

    term = new Xterm({
      theme: {
        background: "#111418", // Match var(--bg-panel)
        foreground: "#e8eaf0",
        cursor: "#00d4aa",
        black: "#0d0f14",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#7c5cfc",
        cyan: "#00d4aa",
        white: "#e8eaf0"
      },
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      rows: 10
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalParentRef);
    fitAddon.fit();

    const py = (window as any).pywebview?.api;

    if (py) {
      // Pipe data from python terminal backend to xterm.js
      (window as any).onTerminalData = (data: string) => {
        term?.write(data);
      };
      
      // Start terminal process relative to current workspace folder
      const workspace = editorStore.get().workspacePath;
      py.start_terminal(workspace);

      // Pipe typed characters from xterm.js to python terminal backend
      term.onData((data) => {
        py.write_terminal_data(data);
      });
    } else {
      // Mock terminal fallback if not running inside the desktop app wrapper
      term.writeln("\x1b[1;36mHyperDrive Terminal v1.0 (Browser Preview Mode)\x1b[0m");
      term.writeln("Ready for local system commands...\r\n");
      term.write("$ ");

      term.onData((data) => {
        if (term) {
          if (data === "\r") {
            term.write("\r\n$ ");
          } else if (data === "\x7f") {
            term.write("\b \b");
          } else {
            term.write(data);
          }
        }
      });
    }

    window.addEventListener("resize", handleResize);
  });

  const handleResize = () => {
    fitAddon?.fit();
  };

  onCleanup(() => {
    window.removeEventListener("resize", handleResize);
    // Remove global callback to prevent memory leaks
    if ((window as any).onTerminalData) {
      delete (window as any).onTerminalData;
    }
    term?.dispose();
  });

  return (
    <div 
      ref={terminalParentRef} 
      style="height: 100%; width: 100%; padding: 8px 12px; background: #111418; overflow: hidden;"
      class="terminal-wrapper"
    ></div>
  );
}
