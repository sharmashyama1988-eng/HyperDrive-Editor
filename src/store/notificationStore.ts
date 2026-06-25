import { createStore, produce } from "solid-js/store";

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration: number;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  resolve: ((val: boolean) => void) | null;
}

interface PromptState {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  resolve: ((val: string | null) => void) | null;
}

interface NotificationState {
  toasts: Toast[];
  confirm: ConfirmState;
  prompt: PromptState;
}

const [state, setState] = createStore<NotificationState>({
  toasts: [],
  confirm: {
    isOpen: false,
    message: "",
    resolve: null,
  },
  prompt: {
    isOpen: false,
    title: "",
    defaultValue: "",
    resolve: null,
  },
});

export const notificationStore = {
  toasts: () => state.toasts,
  confirmState: () => state.confirm,
  promptState: () => state.prompt,

  showToast(message: string, type: Toast["type"] = "info", duration = 3500) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setState(
      produce((s) => {
        s.toasts.push(newToast);
      })
    );

    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
    return id;
  },

  removeToast(id: string) {
    setState(
      "toasts",
      (t) => t.filter((item) => item.id !== id)
    );
  },

  /**
   * Triggers a premium custom confirmation dialog.
   * Usage: const confirmed = await notificationStore.confirm("Are you sure?");
   */
  confirm(message: string): Promise<boolean> {
    if (state.confirm.resolve) {
      state.confirm.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      setState("confirm", {
        isOpen: true,
        message,
        resolve,
      });
    });
  },

  resolveConfirm(value: boolean) {
    const res = state.confirm.resolve;
    if (res) {
      res(value);
    }
    setState("confirm", {
      isOpen: false,
      message: "",
      resolve: null,
    });
  },

  /**
   * Triggers a premium custom prompt input dialog.
   * Usage: const name = await notificationStore.prompt("Enter filename", "index.js");
   */
  prompt(title: string, defaultValue = ""): Promise<string | null> {
    if (state.prompt.resolve) {
      state.prompt.resolve(null);
    }

    return new Promise<string | null>((resolve) => {
      setState("prompt", {
        isOpen: true,
        title,
        defaultValue,
        resolve,
      });
    });
  },

  resolvePrompt(value: string | null) {
    const res = state.prompt.resolve;
    if (res) {
      res(value);
    }
    setState("prompt", {
      isOpen: false,
      title: "",
      defaultValue: "",
      resolve: null,
    });
  },
};
