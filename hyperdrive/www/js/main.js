// main.js - Vanilla JS Editor Logic with Monaco

let editor = null;
let currentFilePath = null;

// Initialize Monaco Editor
require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('monaco-host'), {
    value: ['function helloWorld() {', '\tconsole.log("Welcome to HyperDrive");', '}'].join('\n'),
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: true },
    fontSize: 14,
    fontFamily: "'Fira Code', monospace",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
  });

  // Load saved theme dynamically now that Monaco is ready
  const currentTheme = localStorage.getItem('user-theme') || 'obsidian';
  switchTheme(currentTheme);

  // Trigger PyWebView API bridge initialization once editor is ready
  if (window.pywebview) {
    onPywebviewReady(window.pywebview.api);
  } else {
    window.addEventListener('pywebviewready', () => {
      onPywebviewReady(window.pywebview.api);
    });
  }
});

// Extension Worker Setup
const extWorker = new Worker('js/ext_host.js');
extWorker.onmessage = (e) => {
  const { type, data } = e.data;
  if (type === 'vscode:showInformationMessage') {
    alert("Extension Info: " + data);
  } else if (type === 'vscode:showErrorMessage') {
    alert("Extension Error: " + data);
  } else if (type === 'log') {
    console.log("[ExtHost]", data);
  } else if (type === 'error') {
    console.error("[ExtHost Error]", data);
  }
};

// UI Event Listeners
document.getElementById('action-explorer').addEventListener('click', () => {
  document.getElementById('sidebar-title').innerText = "EXPLORER";
  document.querySelectorAll('.sidebar-view').forEach(el => el.style.display = 'none');
  document.getElementById('file-tree').style.display = 'block';
  document.querySelectorAll('.action-icon').forEach(el => el.classList.remove('active'));
  document.getElementById('action-explorer').classList.add('active');
});

document.getElementById('action-extensions').addEventListener('click', () => {
  document.getElementById('sidebar-title').innerText = "EXTENSIONS";
  document.querySelectorAll('.sidebar-view').forEach(el => el.style.display = 'none');
  document.getElementById('extensions-view').style.display = 'block';
  document.querySelectorAll('.action-icon').forEach(el => el.classList.remove('active'));
  document.getElementById('action-extensions').classList.add('active');
  
  if (window.pywebview) {
    loadExtensions(window.pywebview.api);
  }
});

// Git UI Logic
let currentWorkspacePath = "."; // Default relative root, but should ideally be tracked.

document.getElementById('action-git').addEventListener('click', () => {
  document.getElementById('sidebar-title').innerText = "SOURCE CONTROL";
  document.querySelectorAll('.sidebar-view').forEach(el => el.style.display = 'none');
  document.getElementById('git-view').style.display = 'block';
  document.querySelectorAll('.action-icon').forEach(el => el.classList.remove('active'));
  document.getElementById('action-git').classList.add('active');
});

document.getElementById('btn-git-push').addEventListener('click', async () => {
  const msgInput = document.getElementById('git-commit-msg');
  const msg = msgInput.value.trim() || "Automated commit from HyperDrive";
  const output = document.getElementById('git-status-output');
  const btn = document.getElementById('btn-git-push');
  
  if (!window.pywebview) {
    output.innerText = "Error: Python backend not connected.";
    return;
  }
  
  btn.innerText = "Pushing...";
  btn.disabled = true;
  output.style.color = "var(--text-muted)";
  output.innerText = "Executing git add, commit, and push...";
  
  const res = await window.pywebview.api.git_commit_push(currentWorkspacePath, msg);
  
  btn.innerText = "Commit & Push";
  btn.disabled = false;
  
  if (res.error) {
    output.style.color = "#ff5f56";
    output.innerText = "Error:\n" + res.error;
  } else {
    output.style.color = "#27c93f";
    output.innerText = res.message;
    msgInput.value = "";
  }
});

document.getElementById('action-settings').addEventListener('click', () => {
  document.getElementById('sidebar-title').innerText = "SETTINGS";
  document.querySelectorAll('.sidebar-view').forEach(el => el.style.display = 'none');
  document.getElementById('settings-view').style.display = 'block';
  document.querySelectorAll('.action-icon').forEach(el => el.classList.remove('active'));
  document.getElementById('action-settings').classList.add('active');
});

// AI Chat Right Sidebar Toggle
document.getElementById('action-ai')?.addEventListener('click', () => {
  const secondary = document.getElementById('secondary-sidebar');
  if (secondary.style.display === 'none' || secondary.style.display === '') {
    secondary.style.display = 'flex';
  } else {
    secondary.style.display = 'none';
  }
});

document.getElementById('close-secondary')?.addEventListener('click', () => {
  document.getElementById('secondary-sidebar').style.display = 'none';
});

document.getElementById('action-preview')?.addEventListener('click', async () => {
  if (!window.pywebview) return;
  const api = window.pywebview.api;
  const res = await api.start_preview_server(currentWorkspacePath);
  if (res.url) {
    // Open preview inside editor or external browser
    const prevUrl = res.url;
    alert("Web Preview started at: " + prevUrl);
  } else if (res.error) {
    alert("Preview Error: " + res.error);
  }
});

// Welcome Screen Logic
document.getElementById('btn-open-folder').addEventListener('click', async () => {
  if (!window.pywebview) return;
  const api = window.pywebview.api;
  const folder = await api.select_folder();
  if (folder) {
    document.getElementById('welcome-screen').style.display = 'none';
    currentWorkspacePath = folder;
    try {
      const cwd = await api.read_dir_recursive(folder);
      if (cwd.error) {
        alert("Failed to read directory: " + cwd.error);
      } else {
        renderFileTree(cwd);
      }
    } catch (e) {
      console.error(e);
    }
  }
});

document.getElementById('btn-new-file').addEventListener('click', () => {
  document.getElementById('welcome-screen').style.display = 'none';
  if (editor) {
    editor.setValue("");
    document.getElementById('sidebar-title').innerText = "EXPLORER";
    document.getElementById('file-tree').innerHTML = `<div class="file-item" style="padding:10px; color:var(--text-main); font-style:italic;">Untitled-1</div>`;
  }
});

// Populate recent projects dummy/backend call
async function loadRecentProjects() {
  if (!window.pywebview) return;
  const list = document.getElementById('recent-projects-list');
  // We can fetch from API, assuming `api.get_recent_projects()` exists
  if (window.pywebview.api.get_recent_projects) {
    const projects = await window.pywebview.api.get_recent_projects();
    if (projects && projects.length > 0) {
      list.innerHTML = '';
      projects.forEach(p => {
        const d = document.createElement('div');
        d.className = "recent-item";
        d.style.color = "var(--accent)";
        d.style.cursor = "pointer";
        d.innerText = p;
        d.onclick = async () => {
          document.getElementById('welcome-screen').style.display = 'none';
          currentWorkspacePath = p;
          try {
            const cwd = await window.pywebview.api.read_dir_recursive(p);
            if (!cwd.error) renderFileTree(cwd);
          } catch(e) {}
        };
        list.appendChild(d);
      });
    }
  }
}
setTimeout(loadRecentProjects, 500); // delay to let pywebview inject

// Settings Update Logic
function updateEditorSettings() {
  if (!editor) return;
  const fontSize = parseInt(document.getElementById('setting-font-size').value, 10);
  const tabSize = parseInt(document.getElementById('setting-tab-size').value, 10);
  const wordWrap = document.getElementById('setting-word-wrap').value;
  const minimap = document.getElementById('setting-minimap').value === "true";
  
  editor.updateOptions({
    fontSize: fontSize || 14,
    tabSize: tabSize || 4,
    wordWrap: wordWrap,
    minimap: { enabled: minimap }
  });
}

// Master Theme Switch Function
async function switchTheme(themeName) {
  try {
    const res = await fetch(`themes/${themeName}.json`);
    const theme = await res.json();

    if (window.monaco && editor) {
      monaco.editor.defineTheme(themeName, theme.editor);
      monaco.editor.setTheme(themeName);
    }

    const root = document.documentElement;
    Object.entries(theme.ui).forEach(([cssVar, val]) => {
      root.style.setProperty(cssVar, val);
    });

    localStorage.setItem('user-theme', themeName);
  } catch(e) {
    console.error("Theme switch failed", e);
  }
}

document.getElementById('setting-theme').addEventListener('change', (e) => {
  switchTheme(e.target.value);
});

// Load saved theme on boot
const savedTheme = localStorage.getItem('user-theme') || 'obsidian';
document.getElementById('setting-theme').value = savedTheme;
switchTheme(savedTheme);

document.getElementById('setting-font-size').addEventListener('change', updateEditorSettings);
document.getElementById('setting-tab-size').addEventListener('change', updateEditorSettings);
document.getElementById('setting-word-wrap').addEventListener('change', updateEditorSettings);
document.getElementById('setting-minimap').addEventListener('change', updateEditorSettings);

document.getElementById('btn-install-vsix').addEventListener('click', async () => {
  if (!window.pywebview) return;
  const api = window.pywebview.api;
  const vsixPath = await api.select_file(); // You can select a .vsix file
  if (vsixPath) {
    const btn = document.getElementById('btn-install-vsix');
    btn.innerText = "Installing...";
    const res = await api.install_extension(vsixPath);
    if (res.error) {
      alert("Installation Failed: " + res.error);
    } else {
      alert("Installed successfully: " + res.id);
      loadExtensions(api);
    }
    btn.innerText = "Install from VSIX...";
  }
});

document.getElementById('btn-search-ext')?.addEventListener('click', async () => {
  if (!window.pywebview) return;
  const q = prompt("Search extensions:");
  if (q) {
    const res = await window.pywebview.api.search_online_extensions(q);
    if (res.error) alert(res.error);
    else alert("Found " + res.length + " extensions (Integration coming soon!)");
  }
});

async function loadExtensions(api) {
  const exts = await api.list_extensions();
  const list = document.getElementById('installed-extensions-list');
  list.innerHTML = '';
  
  if (!exts || exts.length === 0) {
    list.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 10px;">No extensions installed.</div>';
    return;
  }
  
  exts.forEach(ext => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.style.padding = "10px";
    div.style.borderBottom = "1px solid var(--border)";
    div.innerHTML = `
      <strong style="color: var(--text-main);">${ext.displayName || ext.name}</strong><br>
      <span style="font-size: 10px; color: var(--text-muted);">${ext.version} - ${ext.id}</span>
      <div style="margin-top: 5px;">
        <button class="btn-load-ext" data-main="${ext.main || ''}" style="background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border); padding: 4px; border-radius: 4px; cursor: pointer;">Activate</button>
      </div>
    `;
    list.appendChild(div);
  });
  
  // Attach activate events
  document.querySelectorAll('.btn-load-ext').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const mainPath = e.target.getAttribute('data-main');
      if (mainPath && mainPath !== 'null') {
        e.target.innerText = "Activating...";
        const scriptData = await api.read_extension_script(mainPath);
        if (scriptData.error) {
          alert("Failed to read script: " + scriptData.error);
        } else {
          // Send script to worker
          extWorker.postMessage({ type: 'load_extension', data: scriptData });
          e.target.innerText = "Activated";
          e.target.style.color = "var(--accent)";
        }
      } else {
        alert("This extension has no main script.");
      }
    });
  });
}

document.getElementById('action-terminal')?.addEventListener('click', () => {
  document.getElementById('panel').classList.toggle('open');
});
document.getElementById('close-panel')?.addEventListener('click', () => {
  document.getElementById('panel').classList.remove('open');
});

// PyWebView Bridge
async function onPywebviewReady(api) {
  console.log("Connected to Python backend.");
}

function renderFileTree(files) {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  files.forEach(f => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerText = (f.is_dir ? '📁 ' : '📄 ') + f.name;
    div.onclick = () => openFile(f.path);
    tree.appendChild(div);
  });
}

async function openFile(path) {
  if (!window.pywebview) return;
  const api = window.pywebview.api;
  try {
    const res = await api.read_file(path);
    if (res && !res.error && typeof res === "string") {
      currentFilePath = path;
      editor.setValue(res);
      // Try to guess language
      const ext = path.split('.').pop();
      let lang = 'plaintext';
      if (ext === 'js') lang = 'javascript';
      else if (ext === 'py') lang = 'python';
      else if (ext === 'html') lang = 'html';
      else if (ext === 'css') lang = 'css';
      else if (ext === 'ts') lang = 'typescript';
      else if (ext === 'json') lang = 'json';
      
      monaco.editor.setModelLanguage(editor.getModel(), lang);
      
      // Update Tab
      document.getElementById('tabs-container').innerHTML = `
        <div class="tab active">${path.split('/').pop() || path}</div>
      `;
    }
  } catch (e) {
    console.error("Cannot open file:", e);
  }
}

// Global Save Keyboard Shortcut
window.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (currentFilePath && window.pywebview) {
      const api = window.pywebview.api;
      try {
        await api.write_file(currentFilePath, editor.getValue());
        console.log("Saved", currentFilePath);
      } catch (err) {
        console.error("Save failed", err);
      }
    }
  }
});
