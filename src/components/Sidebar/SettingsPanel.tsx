// ─────────────────────────────────────────────────────────────────────────────
// HyperDrive — Settings Panel
// VS Code-style: Left category nav + Search bar + Right content panel
// Data-driven: all settings defined as schema → search works automatically
// ─────────────────────────────────────────────────────────────────────────────
import { createSignal, For, Show, createMemo } from "solid-js";
import { settingsStore, EditorSettings } from "@store/settingsStore";

type SettingKey = keyof EditorSettings;
type SettingType = "toggle" | "select" | "text" | "number" | "color";

interface SelectOption { value: string; label: string }

interface SettingDef {
  id: SettingKey;
  label: string;
  hint?: string;
  type: SettingType;
  options?: SelectOption[];
  min?: number; max?: number; step?: number; unit?: string;
  showIf?: () => boolean;  // conditional display
}

interface SubcategoryDef {
  id: string;
  label: string;
  icon?: string;
  settings: SettingDef[];
}

interface CategoryDef {
  id: string;
  icon: string;
  label: string;
  subcategories: SubcategoryDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const SCHEMA: CategoryDef[] = [
  // ── 1. TEXT EDITOR ──────────────────────────────────────────────────────────
  {
    id: "editor",
    icon: "✏️",
    label: "Text Editor",
    subcategories: [
      {
        id: "cursor",
        label: "Cursor",
        icon: "│",
        settings: [
          {
            id: "editor.cursorStyle",
            label: "Cursor Style",
            hint: "Cursor ka look — line, block, ya underline",
            type: "select",
            options: [
              { value: "line",       label: "Line" },
              { value: "line-thin",  label: "Line Thin" },
              { value: "block",      label: "Block" },
              { value: "underline",  label: "Underline" },
            ],
          },
          {
            id: "editor.cursorBlinking",
            label: "Cursor Blinking",
            hint: "Cursor kaise blink karega",
            type: "select",
            options: [
              { value: "blink",  label: "Blink" },
              { value: "smooth", label: "Smooth" },
              { value: "phase",  label: "Phase (fade)" },
              { value: "expand", label: "Expand" },
              { value: "solid",  label: "Solid (no blink)" },
            ],
          },
          {
            id: "editor.cursorSmoothCaretAnimation",
            label: "Cursor Smooth Caret Animation",
            hint: "Cursor move hote waqt smooth animation",
            type: "select",
            options: [
              { value: "off",      label: "Off" },
              { value: "explicit", label: "Explicit" },
              { value: "on",       label: "On" },
            ],
          },
          {
            id: "editor.cursorWidth",
            label: "Cursor Width",
            hint: "Line cursor ki thickness (pixels mein)",
            type: "number",
            min: 1, max: 8, step: 1, unit: "px",
          },
        ],
      },
      {
        id: "font",
        label: "Font",
        icon: "A",
        settings: [
          {
            id: "editor.fontFamily",
            label: "Font Family",
            hint: "Comma-separated. E.g., 'JetBrains Mono', 'Fira Code', monospace",
            type: "text",
          },
          {
            id: "editor.fontSize",
            label: "Font Size",
            hint: "Text ka size pixels mein (default 14)",
            type: "number",
            min: 10, max: 32, unit: "px",
          },
          {
            id: "editor.fontWeight",
            label: "Font Weight",
            hint: "Text kitna bold dikhega",
            type: "select",
            options: [
              { value: "300", label: "Light (300)" },
              { value: "400", label: "Normal (400)" },
              { value: "500", label: "Medium (500)" },
              { value: "600", label: "Semibold (600)" },
              { value: "700", label: "Bold (700)" },
            ],
          },
          {
            id: "editor.fontLigatures",
            label: "Font Ligatures",
            hint: "=> jaisi symbols ko special character mein merge karna",
            type: "toggle",
          },
          {
            id: "editor.lineHeight",
            label: "Line Height",
            type: "number",
            min: 1.0, max: 3.0, step: 0.1,
          },
        ],
      },
      {
        id: "find",
        label: "Find",
        icon: "🔍",
        settings: [
          {
            id: "editor.find.seedSearchStringFromSelection",
            label: "Seed Search From Selection",
            hint: "Select kiya hua text auto-copy hokar search box mein chala jaye",
            type: "select",
            options: [
              { value: "never",     label: "Never" },
              { value: "always",    label: "Always" },
              { value: "selection", label: "Selection Only" },
            ],
          },
          {
            id: "editor.find.matchBackground",
            label: "Find Match Background Color",
            hint: "Match hone wale text ka background color (hex)",
            type: "color",
          },
        ],
      },
      {
        id: "formatting",
        label: "Formatting",
        icon: "⚡",
        settings: [
          {
            id: "editor.formatOnSave",
            label: "Format On Save",
            hint: "File save karte hi code automatically format ho",
            type: "toggle",
          },
          {
            id: "editor.formatOnPaste",
            label: "Format On Paste",
            hint: "Paste karte hi code automatic format ho jaye",
            type: "toggle",
          },
          {
            id: "editor.formatOnType",
            label: "Format On Type",
            hint: "Semicolon ya bracket lagane par line format ho jaye",
            type: "toggle",
          },
          {
            id: "editor.defaultFormatter.python",
            label: "Python Formatter",
            type: "select",
            options: [
              { value: "black",    label: "Black" },
              { value: "autopep8", label: "autopep8" },
              { value: "yapf",     label: "YAPF" },
              { value: "none",     label: "None" },
            ],
          },
          {
            id: "editor.defaultFormatter.javascript",
            label: "JS / TS Formatter",
            type: "select",
            options: [
              { value: "prettier", label: "Prettier" },
              { value: "eslint",   label: "ESLint" },
              { value: "none",     label: "None" },
            ],
          },
          {
            id: "editor.defaultFormatter.html",
            label: "HTML Formatter",
            type: "select",
            options: [
              { value: "prettier", label: "Prettier" },
              { value: "none",     label: "None" },
            ],
          },
          {
            id: "editor.defaultFormatter.css",
            label: "CSS Formatter",
            type: "select",
            options: [
              { value: "prettier", label: "Prettier" },
              { value: "none",     label: "None" },
            ],
          },
        ],
      },
      {
        id: "diffeditor",
        label: "Diff Editor",
        icon: "⟷",
        settings: [
          {
            id: "diffEditor.renderSideBySide",
            label: "Render Side by Side",
            hint: "Files ko aamne-saamne dikhana (On) ya upar-niche (Off)",
            type: "toggle",
          },
          {
            id: "diffEditor.ignoreTrimWhitespace",
            label: "Ignore Trim Whitespace",
            hint: "Compare karte waqt extra spaces ke farq ko ignore karna",
            type: "toggle",
          },
        ],
      },
      {
        id: "minimap",
        label: "Minimap",
        icon: "🗺",
        settings: [
          {
            id: "editor.minimap.enabled",
            label: "Minimap Enabled",
            hint: "Right side mein chota code preview map dikhana ya chhupana",
            type: "toggle",
          },
          {
            id: "editor.minimap.side",
            label: "Minimap Side",
            hint: "Minimap left mein ya right mein",
            type: "select",
            options: [
              { value: "right", label: "Right" },
              { value: "left",  label: "Left" },
            ],
          },
          {
            id: "editor.minimap.maxWidth",
            label: "Minimap Max Width",
            hint: "Minimap ki maximum width",
            type: "number",
            min: 60, max: 300, step: 10, unit: "px",
          },
          {
            id: "editor.minimap.maxColumn",
            label: "Minimap Max Column",
            hint: "Kitne characters tak minimap render karega",
            type: "number",
            min: 40, max: 200, step: 10,
          },
          {
            id: "editor.minimap.renderCharacters",
            label: "Render Characters",
            hint: "Blocks ki jagah real chote characters dikhana",
            type: "toggle",
          },
        ],
      },
      {
        id: "display",
        label: "Display",
        icon: "👁",
        settings: [
          {
            id: "editor.lineNumbers",
            label: "Line Numbers",
            type: "select",
            options: [
              { value: "on",       label: "On" },
              { value: "off",      label: "Off" },
              { value: "relative", label: "Relative" },
            ],
          },
          {
            id: "editor.wordWrap",
            label: "Word Wrap",
            hint: "Lambi lines ko horizontal scroll karna ya screen pe wrap karna",
            type: "select",
            options: [
              { value: "on",             label: "On (wrap)" },
              { value: "off",            label: "Off (scroll)" },
              { value: "wordWrapColumn", label: "Word Wrap Column" },
              { value: "bounded",        label: "Bounded" },
            ],
          },
          {
            id: "editor.renderWhitespace",
            label: "Render Whitespace",
            type: "select",
            options: [
              { value: "none",      label: "None" },
              { value: "boundary",  label: "Boundary" },
              { value: "selection", label: "Selection" },
              { value: "all",       label: "All" },
            ],
          },
          {
            id: "editor.tabSize",
            label: "Tab Size",
            type: "select",
            options: [
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
              { value: "8", label: "8 spaces" },
            ],
          },
          {
            id: "editor.insertSpaces",
            label: "Insert Spaces",
            hint: "Tab key dabaane par spaces insert karna",
            type: "toggle",
          },
        ],
      },
    ],
  },

  // ── 2. WORKBENCH ────────────────────────────────────────────────────────────
  {
    id: "workbench",
    icon: "🏢",
    label: "Workbench",
    subcategories: [
      {
        id: "appearance",
        label: "Appearance",
        icon: "🎨",
        settings: [
          {
            id: "workbench.colorTheme",
            label: "Color Theme",
            hint: "Dark, Light ya custom theme select karna",
            type: "select",
            options: [
              { value: "neon-blue",      label: "Neon Blue (Default)" },
              { value: "github-dark",    label: "GitHub Dark" },
              { value: "vscode-dark",    label: "VS Code Dark" },
              { value: "black-terminal", label: "Black Terminal" },
              { value: "white-light",    label: "White Light" },
            ],
          },
          {
            id: "workbench.iconTheme",
            label: "File Icon Theme",
            hint: "Files ke aage lagne wale icons ka style",
            type: "select",
            options: [
              { value: "none",     label: "None" },
              { value: "material", label: "Material Icons" },
              { value: "seti",     label: "Seti Icons" },
            ],
          },
          {
            id: "workbench.productIconTheme",
            label: "Product Icon Theme",
            hint: "Editor ke buttons aur UI icons ka style",
            type: "select",
            options: [
              { value: "default", label: "Default" },
              { value: "fluent",  label: "Fluent Icons" },
            ],
          },
          {
            id: "workbench.activityBar.visible",
            label: "Activity Bar Visible",
            hint: "Left side wali icon patti ko dikhana ya chhupana",
            type: "toggle",
          },
          {
            id: "workbench.statusBar.visible",
            label: "Status Bar Visible",
            hint: "Sabse niche wali information bar ko dikhana ya chhupana",
            type: "toggle",
          },
          {
            id: "workbench.sideBar.location",
            label: "Side Bar Position",
            hint: "Sidebar left mein rahega ya right mein",
            type: "select",
            options: [
              { value: "left",  label: "Left" },
              { value: "right", label: "Right" },
            ],
          },
        ],
      },
      {
        id: "breadcrumbs",
        label: "Breadcrumbs",
        icon: "🧭",
        settings: [
          {
            id: "breadcrumbs.enabled",
            label: "Breadcrumbs Enabled",
            hint: "File ke upar chalne wala rasta (src > components > Button) dikhana",
            type: "toggle",
          },
          {
            id: "breadcrumbs.filePath",
            label: "Breadcrumbs File Path",
            hint: "Breadcrumb mein sirf file name ya poora path dikhana",
            type: "select",
            options: [
              { value: "on",   label: "Full path" },
              { value: "off",  label: "Off" },
              { value: "last", label: "File name only" },
            ],
          },
        ],
      },
      {
        id: "editor-tabs",
        label: "Editor Tabs",
        icon: "📑",
        settings: [
          {
            id: "workbench.editor.tabsMode",
            label: "Editor Tabs Mode",
            hint: "Multiple tabs dikhen ya single tab",
            type: "select",
            options: [
              { value: "multiple", label: "Multiple (tabs)" },
              { value: "single",   label: "Single" },
              { value: "none",     label: "None" },
            ],
          },
          {
            id: "workbench.editor.tabSizing",
            label: "Tab Sizing",
            hint: "Tabs ki width fixed rahe ya file name ke hisab se badhe",
            type: "select",
            options: [
              { value: "fit",    label: "Fit to content" },
              { value: "shrink", label: "Shrink" },
              { value: "fixed",  label: "Fixed width" },
            ],
          },
          {
            id: "workbench.editor.showIcons",
            label: "Show File Icons in Tabs",
            hint: "Tabs ke andar file icons dikhana ya nahi",
            type: "toggle",
          },
        ],
      },
      {
        id: "zenmode",
        label: "Zen Mode",
        icon: "🧘",
        settings: [
          {
            id: "workbench.zenMode.enabled",
            label: "Zen Mode",
            hint: "Sab UI hide karke sirf editor dikho",
            type: "toggle",
          },
          {
            id: "workbench.zenMode.hideActivityBar",
            label: "Hide Activity Bar",
            type: "toggle",
          },
          {
            id: "workbench.zenMode.hideStatusBar",
            label: "Hide Status Bar",
            type: "toggle",
          },
          {
            id: "workbench.zenMode.hideSideBar",
            label: "Hide Side Bar",
            type: "toggle",
          },
          {
            id: "workbench.zenMode.fullScreen",
            label: "Full Screen",
            type: "toggle",
          },
        ],
      },
    ],
  },

  // ── 3. WINDOW ──────────────────────────────────────────────────────────────
  {
    id: "window",
    icon: "🔍",
    label: "Window",
    subcategories: [
      {
        id: "new-window",
        label: "New Window Behavior",
        icon: "🪟",
        settings: [
          {
            id: "window.openFoldersInNewWindow",
            label: "Open Folders In New Window",
            hint: "Naya folder kholne par nayi window khule ya purani mein",
            type: "select",
            options: [
              { value: "on",      label: "Always new window" },
              { value: "off",     label: "Same window" },
              { value: "default", label: "Default" },
            ],
          },
          {
            id: "window.openFilesInNewWindow",
            label: "Open Files In New Window",
            hint: "Nayi file alag window mein ya tab mein",
            type: "select",
            options: [
              { value: "on",      label: "New window" },
              { value: "off",     label: "Same window (tab)" },
              { value: "default", label: "Default" },
            ],
          },
        ],
      },
      {
        id: "window-behavior",
        label: "Window Behavior",
        icon: "⚙️",
        settings: [
          {
            id: "window.titleBarStyle",
            label: "Title Bar Style",
            hint: "OS default titlebar ya custom dark bar",
            type: "select",
            options: [
              { value: "custom", label: "Custom (dark, HyperDrive style)" },
              { value: "native", label: "Native (OS default)" },
            ],
          },
          {
            id: "window.restoreWindows",
            label: "Restore Windows on Startup",
            hint: "Editor dobara kholne par pichle projects wapas khulein",
            type: "select",
            options: [
              { value: "all",     label: "All windows" },
              { value: "folders", label: "Folders only" },
              { value: "one",     label: "One window" },
              { value: "none",    label: "None" },
            ],
          },
          {
            id: "window.zoomLevel",
            label: "Zoom Level",
            hint: "Poore application ka UI zoom size",
            type: "number",
            min: -3, max: 5, step: 1,
          },
        ],
      },
    ],
  },

  // ── 4. FEATURES ──────────────────────────────────────────────────────────
  {
    id: "features",
    icon: "🛠️",
    label: "Features",
    subcategories: [
      {
        id: "files-mgmt",
        label: "Files",
        icon: "📁",
        settings: [
          {
            id: "files.autoSave",
            label: "Auto Save",
            hint: "File kab automatically save ho",
            type: "select",
            options: [
              { value: "off",            label: "Off" },
              { value: "afterDelay",     label: "After Delay" },
              { value: "onFocusChange",  label: "On Focus Change" },
              { value: "onWindowChange", label: "On Window Change" },
            ],
          },
          {
            id: "files.autoSaveDelay",
            label: "Auto Save Delay",
            hint: "afterDelay chunne par kitne ms baad save ho",
            type: "number",
            min: 300, max: 10000, step: 100, unit: "ms",
            showIf: () => settingsStore.settings["files.autoSave"] === "afterDelay",
          },
          {
            id: "files.encoding",
            label: "Encoding",
            hint: "Default file encoding",
            type: "select",
            options: [
              { value: "utf8",    label: "UTF-8" },
              { value: "utf16le", label: "UTF-16 LE" },
              { value: "utf16be", label: "UTF-16 BE" },
              { value: "cp1252",  label: "Windows 1252" },
            ],
          },
          {
            id: "files.insertFinalNewline",
            label: "Insert Final Newline",
            hint: "File ke end mein hamesha ek blank line add karna",
            type: "toggle",
          },
          {
            id: "files.trimTrailingWhitespace",
            label: "Trim Trailing Whitespace",
            hint: "Line ke end ke faltu spaces automatic delete karna",
            type: "toggle",
          },
          {
            id: "files.exclude",
            label: "Exclude Folders",
            hint: "Explorer aur Search se kaunse folders hide honge (comma-separated)",
            type: "text",
          },
        ],
      },
      {
        id: "terminal",
        label: "Terminal",
        icon: "⌨️",
        settings: [
          {
            id: "terminal.integrated.defaultProfile.windows",
            label: "Default Terminal Profile",
            hint: "Windows par terminal kholne par kya khule",
            type: "select",
            options: [
              { value: "PowerShell",       label: "PowerShell" },
              { value: "Command Prompt",   label: "Command Prompt" },
              { value: "Git Bash",         label: "Git Bash" },
              { value: "WSL",              label: "WSL (Linux)" },
            ],
          },
          {
            id: "terminal.integrated.fontFamily",
            label: "Terminal Font Family",
            hint: "Terminal ke andar ka font",
            type: "text",
          },
          {
            id: "terminal.integrated.fontSize",
            label: "Terminal Font Size",
            type: "number",
            min: 10, max: 24, unit: "px",
          },
          {
            id: "terminal.integrated.cursorStyle",
            label: "Terminal Cursor Style",
            type: "select",
            options: [
              { value: "block",     label: "Block" },
              { value: "line",      label: "Line" },
              { value: "underline", label: "Underline" },
            ],
          },
          {
            id: "terminal.integrated.scrollback",
            label: "Terminal Scrollback",
            hint: "Terminal kitni purani lines ko yaad rakh sakta hai",
            type: "number",
            min: 100, max: 10000, step: 100, unit: "lines",
          },
        ],
      },
      {
        id: "search",
        label: "Search",
        icon: "🔍",
        settings: [
          {
            id: "search.exclude",
            label: "Search Exclude",
            hint: "Global search mein kin folders ko skip karna hai (e.g. **/node_modules)",
            type: "text",
          },
          {
            id: "search.useIgnoreFiles",
            label: "Use Ignore Files",
            hint: ".gitignore mein likhe folders ko search se automatic bahar rakhna",
            type: "toggle",
          },
        ],
      },
      {
        id: "explorer",
        label: "Explorer",
        icon: "📂",
        settings: [
          {
            id: "explorer.autoReveal",
            label: "Auto Reveal",
            hint: "Jo file open hai, sidebar mein automatic highlight karna",
            type: "toggle",
          },
          {
            id: "explorer.confirmDelete",
            label: "Confirm Delete",
            hint: "File delete karte waqt warning popup dikhana",
            type: "toggle",
          },
          {
            id: "explorer.confirmDragAndDrop",
            label: "Confirm Drag & Drop",
            hint: "File ko drag karke dusri jagah daalte waqt confirmation lena",
            type: "toggle",
          },
        ],
      },
      {
        id: "git",
        label: "Source Control (Git)",
        icon: "⎇",
        settings: [
          {
            id: "git.enabled",
            label: "Git Enabled",
            hint: "Git version control integration on/off",
            type: "toggle",
          },
          {
            id: "git.autofetch",
            label: "Auto Fetch",
            hint: "Git repositories se auto-update fetch karte rehna",
            type: "toggle",
          },
          {
            id: "git.confirmSync",
            label: "Confirm Sync",
            hint: "Changes push/pull karte waqt alert dikhana",
            type: "toggle",
          },
        ],
      },
    ],
  },

  // ── 5. SECURITY ──────────────────────────────────────────────────────────
  {
    id: "security",
    icon: "🔒",
    label: "Security",
    subcategories: [
      {
        id: "workspace-trust",
        label: "Workspace Trust",
        icon: "🛡",
        settings: [
          {
            id: "security.workspace.trust.enabled",
            label: "Workspace Trust Enabled",
            hint: "Unknown project folder kholne par user se ijaazat mangna",
            type: "toggle",
          },
        ],
      },
      {
        id: "telemetry",
        label: "Telemetry",
        icon: "📡",
        settings: [
          {
            id: "telemetry.telemetryLevel",
            label: "Telemetry Level",
            hint: "Usage data aur crash reports backend par bhejna ya poori tarah band karna",
            type: "select",
            options: [
              { value: "off",   label: "Off (no data sent)" },
              { value: "crash", label: "Crash reports only" },
              { value: "error", label: "Errors only" },
              { value: "all",   label: "All (usage + crashes)" },
            ],
          },
        ],
      },
      {
        id: "performance",
        label: "Performance",
        icon: "⚡",
        settings: [
          {
            id: "editor.hardwareAcceleration",
            label: "Hardware Acceleration",
            hint: "GPU rendering via DirectX/Metal (restart required)",
            type: "toggle",
          },
          {
            id: "workbench.animationSpeed",
            label: "Animation Speed",
            hint: "UI transition speed — Off = maximum performance",
            type: "select",
            options: [
              { value: "normal", label: "Normal" },
              { value: "fast",   label: "Fast (2×)" },
              { value: "off",    label: "Off (instant)" },
            ],
          },
        ],
      },
    ],
  },

  // ── 6. EXTENSIONS ─────────────────────────────────────────────────────────
  {
    id: "extensions",
    icon: "🧩",
    label: "Extensions",
    subcategories: [
      {
        id: "ext-mgmt",
        label: "Extension Management",
        icon: "🔧",
        settings: [
          {
            id: "extensions.autoUpdate",
            label: "Auto Update Extensions",
            hint: "Plugins automatically update honge",
            type: "toggle",
          },
        ],
      },
      {
        id: "lang-runtimes",
        label: "Language & Runtimes",
        icon: "🔧",
        settings: [
          {
            id: "python.interpreterPath",
            label: "Python Interpreter Path",
            hint: "e.g. python ya C:/Python311/python.exe",
            type: "text",
          },
          {
            id: "node.execPath",
            label: "Node.js Path",
            hint: "e.g. node ya full path",
            type: "text",
          },
          {
            id: "go.goroot",
            label: "Go Root (GOROOT)",
            hint: "GOROOT directory path",
            type: "text",
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONTROL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Toggle(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer;width:38px;height:20px;">
      <input
        type="checkbox" checked={props.checked}
        onChange={e => props.onChange(e.currentTarget.checked)}
        style="opacity:0;width:0;height:0;position:absolute;"
      />
      <span style={{
        position:"absolute", inset:0,
        background: props.checked ? "var(--accent-primary)" : "var(--bg-hover)",
        "border-radius":"20px", border:"1px solid var(--border-default)",
        transition:"background var(--transition-fast)",
      }}/>
      <span style={{
        position:"absolute",
        left: props.checked ? "20px" : "2px",
        width:"14px", height:"14px",
        background: props.checked ? "var(--bg-void)" : "var(--text-muted)",
        "border-radius":"50%",
        transition:"left var(--transition-fast)",
        "box-shadow":"0 1px 3px rgba(0,0,0,0.4)",
      }}/>
    </label>
  );
}

function SelectCtrl(props: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={props.value}
      onChange={e => props.onChange(e.currentTarget.value)}
      style={{
        background:"var(--bg-input)", border:"1px solid var(--border-default)",
        color:"var(--text-primary)", padding:"5px 8px",
        "border-radius":"var(--radius-sm)", outline:"none",
        cursor:"pointer", "font-size":"var(--font-size-xs)",
        "min-width":"140px", "max-width":"200px",
      }}
    >
      <For each={props.options}>
        {o => <option value={o.value}>{o.label}</option>}
      </For>
    </select>
  );
}

function TextCtrl(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text" value={props.value} placeholder={props.placeholder}
      onInput={e => props.onChange(e.currentTarget.value)}
      style={{
        background:"var(--bg-input)", border:"1px solid var(--border-default)",
        color:"var(--text-primary)", padding:"5px 10px",
        "border-radius":"var(--radius-sm)", outline:"none",
        "font-size":"var(--font-size-xs)", width:"180px",
      }}
    />
  );
}

function NumberCtrl(props: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div style="display:flex;align-items:center;gap:8px;">
      <input
        type="range" min={props.min} max={props.max} step={props.step ?? 1}
        value={props.value}
        onInput={e => props.onChange(parseFloat(e.currentTarget.value))}
        style="cursor:pointer;accent-color:var(--accent-primary);width:100px;"
      />
      <input
        type="number" min={props.min} max={props.max} step={props.step ?? 1}
        value={props.value}
        onInput={e => props.onChange(parseFloat(e.currentTarget.value))}
        style={{
          width:"56px", background:"var(--bg-input)",
          border:"1px solid var(--border-default)", color:"var(--accent-primary)",
          "border-radius":"var(--radius-sm)", padding:"3px 6px", outline:"none",
          "font-size":"var(--font-size-xs)", "font-weight":"600", "text-align":"center",
        }}
      />
      <Show when={props.unit}>
        <span style="font-size:10px;color:var(--text-muted);">{props.unit}</span>
      </Show>
    </div>
  );
}

function ColorCtrl(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div style="display:flex;align-items:center;gap:8px;">
      <input
        type="color" value={props.value}
        onInput={e => props.onChange(e.currentTarget.value)}
        style="width:32px;height:28px;cursor:pointer;border:1px solid var(--border-default);border-radius:var(--radius-sm);background:none;padding:2px;"
      />
      <input
        type="text" value={props.value}
        onInput={e => props.onChange(e.currentTarget.value)}
        style={{
          width:"80px", background:"var(--bg-input)",
          border:"1px solid var(--border-default)", color:"var(--text-primary)",
          "border-radius":"var(--radius-sm)", padding:"4px 8px",
          "font-size":"var(--font-size-xs)", "font-family":"var(--font-mono)", outline:"none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SETTING ROW
// ─────────────────────────────────────────────────────────────────────────────
function SettingRow(props: { def: SettingDef; highlight?: string }) {
  const s = settingsStore.settings;
  const rawVal = () => s[props.def.id] as any;

  const handleChange = (val: any) => {
    let parsed = val;
    if (props.def.type === "number") parsed = parseFloat(val);
    if (props.def.id === "editor.tabSize") parsed = parseInt(val);
    (settingsStore.update as any)(props.def.id, parsed);
  };

  const getOptions = () => {
    if (props.def.id === "workbench.colorTheme") {
      const vscodeThemes = (window as any)._vscode_themes || [];
      const vsOptions = vscodeThemes.map((t: any) => ({
        value: t.label,
        label: `${t.label} (Extension)`
      }));
      return [...(props.def.options || []), ...vsOptions];
    }
    return props.def.options || [];
  };

  const highlightLabel = () => {
    if (!props.highlight) return props.def.label;
    return props.def.label; // handled with CSS mark below
  };

  return (
    <div style={{
      display:"flex", "align-items":"center", gap:"12px",
      padding:"9px 16px", "border-bottom":"1px solid var(--border-subtle)",
      transition:"background var(--transition-fast)",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      {/* Label + hint */}
      <div style="flex:1;min-width:0;">
        <div style="font-size:var(--font-size-sm);color:var(--text-primary);line-height:1.4;">
          {props.def.label}
        </div>
        <Show when={props.def.hint}>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.5;">
            {props.def.hint}
          </div>
        </Show>
      </div>

      {/* Control */}
      <div style="flex-shrink:0;">
        <Show when={props.def.type === "toggle"}>
          <Toggle checked={!!rawVal()} onChange={handleChange} />
        </Show>
        <Show when={props.def.type === "select"}>
          <SelectCtrl
            value={String(rawVal())}
            options={getOptions()}
            onChange={handleChange}
          />
        </Show>
        <Show when={props.def.type === "text"}>
          <TextCtrl value={String(rawVal() ?? "")} onChange={handleChange} />
        </Show>
        <Show when={props.def.type === "number"}>
          <NumberCtrl
            value={Number(rawVal())}
            min={props.def.min ?? 0}
            max={props.def.max ?? 100}
            step={props.def.step}
            unit={props.def.unit}
            onChange={handleChange}
          />
        </Show>
        <Show when={props.def.type === "color"}>
          <ColorCtrl value={String(rawVal() ?? "#000000")} onChange={handleChange} />
        </Show>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPanel() {
  const [activeCatId, setActiveCatId] = createSignal("editor");
  const [search, setSearch] = createSignal("");

  let searchRef: HTMLInputElement | undefined;

  // ── Search: collect all settings defs with category label ─────────────────
  const allDefs = createMemo(() => {
    const list: { def: SettingDef; catLabel: string; subLabel: string }[] = [];
    for (const cat of SCHEMA) {
      for (const sub of cat.subcategories) {
        for (const def of sub.settings) {
          list.push({ def, catLabel: cat.label, subLabel: sub.label });
        }
      }
    }
    return list;
  });

  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return null; // null = show active category normally
    return allDefs().filter(
      ({ def }) =>
        def.label.toLowerCase().includes(q) ||
        (def.hint ?? "").toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
    );
  });

  const activeCategory = createMemo(() =>
    SCHEMA.find(c => c.id === activeCatId())!
  );

  return (
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div style={{
        padding:"8px 10px",
        "border-bottom":"1px solid var(--border-subtle)",
        "flex-shrink":0,
        background:"var(--bg-panel)",
      }}>
        <div style="display:flex;align-items:center;gap:6px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:6px 10px;">
          <span style="font-size:12px;color:var(--text-muted);">🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
            placeholder="Search settings…"
            style={{
              flex:1, background:"transparent", border:"none", outline:"none",
              color:"var(--text-primary)", "font-size":"var(--font-size-sm)",
            }}
          />
          <Show when={search()}>
            <button
              onClick={() => setSearch("")}
              style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0 2px;"
            >✕</button>
          </Show>
        </div>
      </div>

      {/* ── Body: left nav + right content ──────────────────────────────────── */}
      <div style="display:flex;flex:1;overflow:hidden;">

        {/* Left category nav */}
        <Show when={!search()}>
          <div style={{
            width:"130px", "flex-shrink":0,
            "border-right":"1px solid var(--border-subtle)",
            "overflow-y":"auto", padding:"6px 4px",
            background:"var(--bg-panel)",
          }}>
            <For each={SCHEMA}>
              {cat => (
                <button
                  onClick={() => { setActiveCatId(cat.id); setSearch(""); }}
                  style={{
                    display:"flex", "align-items":"center", gap:"7px",
                    padding:"8px 8px", width:"100%",
                    background: activeCatId() === cat.id ? "var(--bg-active)" : "transparent",
                    color: activeCatId() === cat.id ? "var(--accent-primary)" : "var(--text-secondary)",
                    border: activeCatId() === cat.id ? "1px solid var(--border-accent)" : "1px solid transparent",
                    "border-radius":"var(--radius-sm)",
                    "font-size":"11px",
                    "font-weight": activeCatId() === cat.id ? "700" : "400",
                    cursor:"pointer",
                    "text-align":"left",
                    transition:"all var(--transition-fast)",
                    "box-shadow": activeCatId() === cat.id ? "var(--glow-primary)" : "none",
                    "margin-bottom":"2px",
                  }}
                >
                  <span style="font-size:14px;">{cat.icon}</span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{cat.label}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Right content */}
        <div style="flex:1;overflow-y:auto;">

          {/* ── Search results ── */}
          <Show when={filtered()}>
            <div style="padding:8px 0;">
              <div style="padding:6px 16px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
                {filtered()!.length} result{filtered()!.length !== 1 ? "s" : ""} for "{search()}"
              </div>
              <Show when={filtered()!.length === 0}>
                <div style="padding:40px;text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">
                  No settings found for "<strong>{search()}</strong>"
                </div>
              </Show>
              <For each={filtered()}>
                {({ def, catLabel, subLabel }) => (
                  <div>
                    <div style="padding:4px 16px;font-size:9px;color:var(--text-muted);background:var(--bg-active);">
                      {catLabel} › {subLabel}
                    </div>
                    <Show when={!def.showIf || def.showIf()}>
                      <SettingRow def={def} highlight={search()} />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* ── Category view ── */}
          <Show when={!filtered()}>
            <For each={activeCategory().subcategories}>
              {sub => (
                <div>
                  {/* Subcategory header */}
                  <div style={{
                    padding:"12px 16px 6px",
                    "border-bottom":"1px solid var(--border-subtle)",
                    "background":"var(--bg-panel)",
                    display:"flex", "align-items":"center", gap:"8px",
                    position:"sticky", top:0, "z-index":1,
                  }}>
                    <Show when={sub.icon}>
                      <span style="font-size:13px;opacity:0.8;">{sub.icon}</span>
                    </Show>
                    <span style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.6px;">
                      {sub.label}
                    </span>
                  </div>

                  {/* Settings rows */}
                  <For each={sub.settings}>
                    {def => (
                      <Show when={!def.showIf || def.showIf()}>
                        <SettingRow def={def} />
                      </Show>
                    )}
                  </For>
                </div>
              )}
            </For>
          </Show>

        </div>
      </div>
    </div>
  );
}
