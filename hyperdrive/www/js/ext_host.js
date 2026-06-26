// ext_host.js - Web Worker for VS Code Extension API Mock

console.log("Extension Host Worker Started");

const vscode = {
  window: {
    showInformationMessage: (msg) => {
      postMessage({ type: 'vscode:showInformationMessage', data: msg });
    },
    showErrorMessage: (msg) => {
      postMessage({ type: 'vscode:showErrorMessage', data: msg });
    },
  },
  workspace: {
    getConfiguration: () => ({
      get: (key) => null
    })
  },
  commands: {
    registerCommand: (cmd, callback) => {
      // Mock command registration
      console.log("Registered VS Code command in worker:", cmd);
    }
  }
};

// Global context for extensions
self.vscode = vscode;

// Listen for messages from main thread
self.addEventListener('message', (e) => {
  const { type, data } = e.data;
  
  if (type === 'load_extension') {
    try {
      // data contains the raw JS code of the extension's entry point
      const func = new Function('vscode', data);
      func(vscode);
      postMessage({ type: 'log', data: "Extension loaded successfully" });
    } catch (err) {
      postMessage({ type: 'error', data: "Extension load failed: " + err.message });
    }
  }
});
