import { render } from "solid-js/web";
import "@styles/global.css";
import "@styles/themes.css";
import "@styles/editor-theme.css";
import "@styles/ai-panel.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

render(() => <App />, root);
