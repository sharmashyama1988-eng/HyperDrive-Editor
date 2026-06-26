import os
import sys
import json
import subprocess
import webview
import ctypes
import threading
import time

import queue

class SmoothEngine:
    _dll = None
    _dll_loaded = False
    
    @classmethod
    def load(cls):
        if cls._dll_loaded:
            return cls._dll
        # Load from directory where app.py is located
        dll_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smooth_engine.dll")
        if os.path.exists(dll_path):
            try:
                cls._dll = ctypes.CDLL(dll_path)
                cls._dll_loaded = True
                print("SUCCESS: Smooth Engine C++ DLL loaded!")
                try:
                    cls._dll.setup_crash_interceptor()
                except Exception as e:
                    print("Failed to setup crash interceptor:", e)
            except Exception as e:
                print("Failed to load smooth_engine.dll:", e)
        return cls._dll

# Pure-Python fallbacks that mimic C++ DLL API
class PythonRingBuffer:
    def __init__(self, size=262144):
        self.size = size
        self.buffer = ctypes.create_string_buffer(size)
        self.head = 0
        self.tail = 0
        self.lock = threading.Lock()

    def push(self, data):
        with self.lock:
            if isinstance(data, str):
                b = data.encode('utf-8', errors='ignore')
            else:
                b = data
            for byte in b:
                next_head = (self.head + 1) % self.size
                if next_head != self.tail:
                    self.buffer[self.head] = bytes([byte])
                    self.head = next_head

    def pop_all(self):
        with self.lock:
            if self.head == self.tail:
                return ""
            chunks = []
            while self.tail != self.head:
                chunks.append(self.buffer[self.tail])
                self.tail = (self.tail + 1) % self.size
            return b"".join(chunks).decode('utf-8', errors='ignore')

class PythonPriorityScheduler:
    def __init__(self):
        super().__init__()
        self.queue = queue.PriorityQueue()
        self.throttle_level = 0.0

    def push(self, task_id, priority):
        self.queue.put((-priority, task_id))

    def pop(self):
        if self.queue.empty():
            return -1
        try:
            _, task_id = self.queue.get_nowait()
            return task_id
        except queue.Empty:
            return -1

    def set_throttle(self, level):
        self.throttle_level = level

    def get_throttle(self):
        return self.throttle_level

class PythonPredictivePrefetcher:
    def __init__(self):
        self.transitions = {}
        self.lock = threading.Lock()

    def train(self, current_file, next_file):
        if not current_file or not next_file or current_file == next_file:
            return
        with self.lock:
            if current_file not in self.transitions:
                self.transitions[current_file] = {}
            self.transitions[current_file][next_file] = self.transitions[current_file].get(next_file, 0) + 1

    def predict(self, current_file):
        if not current_file:
            return ""
        with self.lock:
            if current_file not in self.transitions:
                return ""
            targets = self.transitions[current_file]
            if not targets:
                return ""
            return max(targets, key=targets.get)

class SmoothRingBuffer:
    def __init__(self, size=262144):
        self.size = size
        self.dll = SmoothEngine.load()
        if self.dll:
            try:
                self.dll.ring_buffer_create.restype = ctypes.c_void_p
                self.dll.ring_buffer_create.argtypes = [ctypes.c_int]
                self.rb = self.dll.ring_buffer_create(size)
            except Exception as e:
                print("Failed to create C++ ring buffer, using python fallback:", e)
                self.dll = None
                self.py_rb = PythonRingBuffer(size)
        else:
            self.py_rb = PythonRingBuffer(size)

    def push(self, data):
        if self.dll:
            try:
                self.dll.ring_buffer_push.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
                b = data.encode('utf-8', errors='ignore') if isinstance(data, str) else data
                self.dll.ring_buffer_push(self.rb, b, len(b))
            except Exception as e:
                print("C++ ring_buffer_push failed, falling back:", e)
                if not hasattr(self, 'py_rb'):
                    self.py_rb = PythonRingBuffer(self.size)
                self.dll = None
                self.py_rb.push(data)
        else:
            self.py_rb.push(data)

    def pop_all(self):
        if self.dll:
            try:
                self.dll.ring_buffer_pop_all.restype = ctypes.c_int
                self.dll.ring_buffer_pop_all.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
                out_buf = ctypes.create_string_buffer(self.size)
                bytes_read = self.dll.ring_buffer_pop_all(self.rb, out_buf, self.size)
                return out_buf.raw[:bytes_read].decode('utf-8', errors='ignore')
            except Exception as e:
                print("C++ ring_buffer_pop_all failed, falling back:", e)
                if not hasattr(self, 'py_rb'):
                    self.py_rb = PythonRingBuffer(self.size)
                self.dll = None
                return self.py_rb.pop_all()
        else:
            return self.py_rb.pop_all()

    def __del__(self):
        if hasattr(self, 'dll') and self.dll and hasattr(self, 'rb'):
            try:
                self.dll.ring_buffer_destroy.argtypes = [ctypes.c_void_p]
                self.dll.ring_buffer_destroy(self.rb)
            except:
                pass

class SmoothSchedulerWrapper:
    def __init__(self):
        self.dll = SmoothEngine.load()
        if self.dll:
            try:
                self.dll.scheduler_create.restype = ctypes.c_void_p
                self.sched = self.dll.scheduler_create()
            except Exception as e:
                print("Failed to create C++ scheduler, using python fallback:", e)
                self.dll = None
                self.py_sched = PythonPriorityScheduler()
        else:
            self.py_sched = PythonPriorityScheduler()

    def push(self, task_id, priority):
        if self.dll:
            try:
                self.dll.scheduler_push.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
                self.dll.scheduler_push(self.sched, task_id, priority)
            except Exception as e:
                print("C++ scheduler_push failed:", e)
        else:
            self.py_sched.push(task_id, priority)

    def pop(self):
        if self.dll:
            try:
                self.dll.scheduler_pop.restype = ctypes.c_int
                self.dll.scheduler_pop.argtypes = [ctypes.c_void_p]
                return self.dll.scheduler_pop(self.sched)
            except Exception as e:
                print("C++ scheduler_pop failed:", e)
                return -1
        else:
            return self.py_sched.pop()

    def set_throttle(self, level):
        if self.dll:
            try:
                self.dll.scheduler_set_throttle.argtypes = [ctypes.c_void_p, ctypes.c_double]
                self.dll.scheduler_set_throttle(self.sched, level)
            except Exception as e:
                print("C++ scheduler_set_throttle failed:", e)
        else:
            self.py_sched.set_throttle(level)

    def get_throttle(self):
        if self.dll:
            try:
                self.dll.scheduler_get_throttle.restype = ctypes.c_double
                self.dll.scheduler_get_throttle.argtypes = [ctypes.c_void_p]
                return self.dll.scheduler_get_throttle(self.sched)
            except Exception as e:
                print("C++ scheduler_get_throttle failed:", e)
                return 0.0
        else:
            return self.py_sched.get_throttle()

    def __del__(self):
        if hasattr(self, 'dll') and self.dll and hasattr(self, 'sched'):
            try:
                self.dll.scheduler_destroy.argtypes = [ctypes.c_void_p]
                self.dll.scheduler_destroy(self.sched)
            except:
                pass

class SmoothPrefetcherWrapper:
    def __init__(self):
        self.dll = SmoothEngine.load()
        if not self.dll:
            self.py_prefetcher = PythonPredictivePrefetcher()

    def train(self, current_file, next_file):
        if self.dll:
            try:
                self.dll.prefetcher_train.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
                self.dll.prefetcher_train(current_file.encode('utf-8', errors='ignore'), next_file.encode('utf-8', errors='ignore'))
            except Exception as e:
                print("C++ prefetcher_train failed:", e)
        else:
            self.py_prefetcher.train(current_file, next_file)

    def predict(self, current_file):
        if self.dll:
            try:
                self.dll.prefetcher_predict.restype = ctypes.c_int
                self.dll.prefetcher_predict.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
                out_buf = ctypes.create_string_buffer(512)
                success = self.dll.prefetcher_predict(current_file.encode('utf-8', errors='ignore'), out_buf, 512)
                if success:
                    return out_buf.value.decode('utf-8', errors='ignore')
            except Exception as e:
                print("C++ prefetcher_predict failed:", e)
            return ""
        else:
            return self.py_prefetcher.predict(current_file)

def get_system_cpu_load():
    dll = SmoothEngine.load()
    if dll:
        try:
            dll.get_cpu_load.restype = ctypes.c_double
            return dll.get_cpu_load()
        except:
            pass
    # Windows native ctypes fallback
    if os.name == 'nt':
        try:
            class FILETIME(ctypes.Structure):
                _fields_ = [("dwLowDateTime", ctypes.c_uint), ("dwHighDateTime", ctypes.c_uint)]
            idle = FILETIME()
            kernel = FILETIME()
            user = FILETIME()
            if ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user)):
                if not hasattr(get_system_cpu_load, "last_times"):
                    get_system_cpu_load.last_times = (0, 0, 0)
                
                idle_t = (idle.dwHighDateTime << 32) | idle.dwLowDateTime
                kernel_t = (kernel.dwHighDateTime << 32) | kernel.dwLowDateTime
                user_t = (user.dwHighDateTime << 32) | user.dwLowDateTime
                
                last_idle, last_kernel, last_user = get_system_cpu_load.last_times
                get_system_cpu_load.last_times = (idle_t, kernel_t, user_t)
                
                idle_diff = idle_t - last_idle
                kernel_diff = kernel_t - last_kernel
                user_diff = user_t - last_user
                total_diff = kernel_diff + user_diff
                if total_diff == 0:
                    return 0.0
                return (total_diff - idle_diff) * 100.0 / total_diff
        except Exception as e:
            pass
    return 0.0

def get_process_ram_usage():
    dll = SmoothEngine.load()
    if dll:
        try:
            dll.get_ram_usage.restype = ctypes.c_ulonglong
            return dll.get_ram_usage()
        except:
            pass
    # Windows native ctypes fallback
    if os.name == 'nt':
        try:
            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", ctypes.c_uint),
                    ("PageFaultCount", ctypes.c_uint),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakWorkingSetSize", ctypes.c_size_t),
                    ("QuotaWorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolSize", ctypes.c_size_t),
                    ("QuotaPagedPoolSize", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolSize", ctypes.c_size_t),
                    ("QuotaNonPagedPoolSize", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t)
                ]
            pmc = PROCESS_MEMORY_COUNTERS()
            pmc.cb = ctypes.sizeof(pmc)
            ctypes.windll.psapi.GetProcessMemoryInfo(
                ctypes.windll.kernel32.GetCurrentProcess(),
                ctypes.byref(pmc),
                pmc.cb
            )
            return pmc.WorkingSetSize
        except Exception as e:
            pass
    return 0



from api.preview_tool import PreviewTool
from api.fs_tool import FsTool
from api.git_tool import GitTool
from api.extension_tool import ExtensionTool
from api.ai_tool import AiTool

class HyperDriveAPI(PreviewTool, FsTool, GitTool, ExtensionTool, AiTool):
    def __init__(self):
        self.workspace_path = None
        self._window = None
        self.prefetcher = SmoothPrefetcherWrapper()
        self._scheduler_wrapper = SmoothSchedulerWrapper()
        self._last_file_opened = None
        self._telemetry_running = True
        
        # Local preview server variables
        self.preview_server = None
        self.preview_port = None
        self.preview_dir = None
        
        # LSP processes and threads dictionaries
        self._lsp_processes = {}  # lang -> Popen
        self._lsp_threads = {}    # lang -> Thread
        
        # Start telemetry loop thread
        threading.Thread(target=self._telemetry_loop, daemon=True).start()

    def set_workspace_path(self, path):
        self.workspace_path = path.replace("\\", "/")
        print("Python workspace path updated to:", self.workspace_path)
        # Pre-start or restart local preview server for this workspace path
        self.start_preview_server(self.workspace_path)
        return {"success": True}











    def find_bundled_lsp(self, language):
        import shutil
        ext_dir = self.get_extensions_dir()
        if not os.path.exists(ext_dir):
            return None
            
        patterns = []
        if language == "rust":
            patterns = ["rust-analyzer.exe", "rust-analyzer"]
        elif language == "python":
            patterns = ["pyright-langserver.js", "pyright-langserver", "pyright", "jedi-language-server"]
        elif language == "typescript" or language == "javascript":
            patterns = ["typescript-language-server", "tsserver.js"]
        elif language == "go":
            patterns = ["gopls.exe", "gopls"]
        elif language == "cpp" or language == "c":
            patterns = ["clangd.exe", "clangd"]
        elif language == "html":
            patterns = ["htmlServerMain.js"]
        elif language == "css":
            patterns = ["cssServerMain.js"]
        elif language == "json":
            patterns = ["jsonServerMain.js"]

        if not patterns:
            return None

        for root, dirs, files in os.walk(ext_dir):
            for file in files:
                if file.lower() in [p.lower() for p in patterns]:
                    full_path = os.path.join(root, file).replace("\\", "/")
                    if file.endswith(".js"):
                        node_cmd = shutil.which("node")
                        if node_cmd:
                            return [node_cmd, full_path]
                    else:
                        return [full_path]
        return None

    def start_lsp_server(self, language, root_path):
        import shutil
        if language in self._lsp_processes and self._lsp_processes[language].poll() is None:
            return {"success": True, "message": "LSP server already running"}

        command = ""
        args = []
        
        # 1. Check bundled LSP inside installed extensions
        bundled = self.find_bundled_lsp(language)
        if bundled:
            command = bundled[0]
            if len(bundled) > 1:
                args = bundled[1:] + ["--stdio"]
            else:
                if language in ["python", "typescript", "javascript", "html", "css", "json"]:
                    args = ["--stdio"]
                else:
                    args = []
            print(f"Using bundled LSP for {language}: {command} {args}")
        else:
            # 2. Fallback to system-wide
            if language == "python":
                command = shutil.which("pyright-langserver") or shutil.which("pyright")
                args = ["--stdio"]
            elif language == "typescript" or language == "javascript":
                command = shutil.which("typescript-language-server")
                args = ["--stdio"]
            elif language == "go":
                command = shutil.which("gopls")
                args = []
            elif language == "rust":
                command = shutil.which("rust-analyzer")
                args = []

        if not command:
            return {"error": f"LSP server executable for {language} not found in PATH or extensions."}

        try:
            proc = subprocess.Popen(
                [command] + args,
                cwd=root_path,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            self._lsp_processes[language] = proc

            def read_lsp_stdout():
                while True:
                    if proc.poll() is not None:
                        break
                    try:
                        line = proc.stdout.readline()
                        if not line:
                            break
                        line_str = line.decode('utf-8', errors='ignore').strip()
                        if line_str.startswith("Content-Length:"):
                            length = int(line_str.split(":")[1].strip())
                            proc.stdout.readline()
                            body = proc.stdout.read(length)
                            body_str = body.decode('utf-8', errors='ignore')
                            if self._window:
                                escaped_msg = json.dumps(body_str)
                                self._window.evaluate_js(f"if (window.onLSPMessage) window.onLSPMessage('{language}', {escaped_msg});")
                    except Exception as e:
                        print(f"LSP Read Error ({language}):", e)
                        break

            t = threading.Thread(target=read_lsp_stdout, daemon=True)
            t.start()
            self._lsp_threads[language] = t
            print(f"LSP server for {language} successfully started!")
            return {"success": True}
        except Exception as e:
            return {"error": f"Failed to start LSP: {str(e)}"}

    def send_lsp_message(self, language, message_str):
        if language in self._lsp_processes:
            proc = self._lsp_processes[language]
            if proc.poll() is None and proc.stdin:
                try:
                    payload = message_str.encode('utf-8')
                    header = f"Content-Length: {len(payload)}\r\n\r\n"
                    proc.stdin.write(header.encode('utf-8') + payload)
                    proc.stdin.flush()
                    return {"success": True}
                except Exception as e:
                    return {"error": str(e)}
        return {"error": "LSP server not running"}

    def _telemetry_loop(self):
        while self._telemetry_running:
            try:
                time.sleep(2.0)
                cpu = get_system_cpu_load()
                ram = get_process_ram_usage()
                
                # Dynamic throttling factor (0.0 to 1.0)
                throttle = 0.0
                if cpu > 70.0:
                    # 70% to 95% CPU scales throttle from 0.0 to 1.0
                    throttle = min(1.0, (cpu - 70.0) / 25.0)
                if ram > 200 * 1024 * 1024:  # 200MB limit before throttling starts
                    ram_throttle = min(1.0, (ram - 200 * 1024 * 1024) / (200 * 1024 * 1024))
                    throttle = max(throttle, ram_throttle)
                
                self._scheduler_wrapper.set_throttle(throttle)
            except Exception as e:
                print("SmoothEngine Telemetry error:", e)

    def set_window(self, window):
        self._window = window


    def _get_config_path(self):
        config_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive")
        os.makedirs(config_dir, exist_ok=True)
        return os.path.join(config_dir, "config.json")

    def _read_config(self):
        path = self._get_config_path()
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                pass
        return {}

    def _write_config(self, config):
        path = self._get_config_path()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=4)
        except Exception as e:
            print("Failed to write config:", e)

    def get_recent_projects(self):
        config = self._read_config()
        return config.get("recent_projects", [])

    def log_message(self, msg):
        print(f"[FRONTEND LOG]: {msg}")
        return True

    def add_recent_project(self, project_path):
        import time
        try:
            project_path = project_path.replace("\\", "/")
            if project_path.endswith("/") and len(project_path) > 3:
                project_path = project_path[:-1]
            name = project_path.split("/")[-1] or project_path
            
            config = self._read_config()
            recents = config.get("recent_projects", [])
            
            # Remove duplicate if exists
            recents = [p for p in recents if p.get("path") != project_path]
            
            # Detect type
            p_lower = project_path.lower()
            p_type = "web"
            if "python" in p_lower or p_lower.endswith(".py"):
                p_type = "python"
            elif "java" in p_lower or "spring" in p_lower:
                p_type = "java"
            elif "node" in p_lower or "express" in p_lower:
                p_type = "node"
                
            recents.insert(0, {
                "path": project_path,
                "name": name,
                "lastOpened": int(time.time() * 1000),
                "type": p_type
            })
            # Limit to 10
            recents = recents[:10]
            config["recent_projects"] = recents
            self._write_config(config)
            return {"success": True, "recent_projects": recents}
        except Exception as e:
            return {"error": str(e)}

    def remove_recent_project(self, project_path):
        try:
            config = self._read_config()
            recents = config.get("recent_projects", [])
            recents = [p for p in recents if p.get("path") != project_path]
            config["recent_projects"] = recents
            self._write_config(config)
            return {"success": True, "recent_projects": recents}
        except Exception as e:
            return {"error": str(e)}

    def clear_recent_projects(self):
        try:
            config = self._read_config()
            config["recent_projects"] = []
            self._write_config(config)
            return {"success": True, "recent_projects": []}
        except Exception as e:
            return {"error": str(e)}

    def get_credentials(self):
        config = self._read_config()
        return {
            "github_username": config.get("github_username", ""),
            "github_token": config.get("github_token", ""),
            "gemini_api_key": config.get("gemini_api_key", ""),
            "api_type": config.get("api_type", "gemini"),
            "api_base_url": config.get("api_base_url", "https://openrouter.ai/api/v1"),
            "model_name": config.get("model_name", "gemini-1.5-flash")
        }

    def save_credentials(self, github_username, github_token, gemini_api_key, api_type=None, api_base_url=None, model_name=None):
        try:
            config = self._read_config()
            if github_username is not None:
                config["github_username"] = github_username
            if github_token is not None:
                config["github_token"] = github_token
            if gemini_api_key is not None:
                config["gemini_api_key"] = gemini_api_key
            if api_type is not None:
                config["api_type"] = api_type
            if api_base_url is not None:
                config["api_base_url"] = api_base_url
            if model_name is not None:
                config["model_name"] = model_name
            self._write_config(config)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}




    def minimize_window(self):
        if self._window:
            self._window.minimize()

    def maximize_window(self):
        if self._window:
            self._window.maximize()

    def restore_window(self):
        if self._window:
            self._window.restore()

    def close_window(self):
        # Terminate active terminal process if running
        if hasattr(self, '_term_proc') and self._term_proc:
            try:
                self._term_proc.terminate()
            except:
                pass
        if self._window:
            self._window.destroy()

    def start_terminal(self, cwd_path=None):
        import threading
        # Ensure we don't start multiple processes
        if hasattr(self, '_term_proc') and self._term_proc and self._term_proc.poll() is None:
            return

        try:
            # Start real PowerShell shell
            self._term_proc = subprocess.Popen(
                ["powershell.exe", "-NoLogo", "-NoProfile"],
                cwd=cwd_path if cwd_path and os.path.exists(cwd_path) else None,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            # C-style thread-safe ring buffer
            ring_buffer = SmoothRingBuffer(size=262144)

            # Thread to read characters from a stream and push to the ring buffer
            def read_stream(stream):
                while True:
                    if not hasattr(self, '_term_proc') or not self._term_proc or self._term_proc.poll() is not None:
                        break
                    try:
                        char = stream.read(1)
                        if not char:
                            break
                        ring_buffer.push(char)
                    except:
                        break

            # Batching consumer thread: flushes ring buffer every 15ms (adaptive under CPU load)
            def flush_buffer():
                while True:
                    shell_active = hasattr(self, '_term_proc') and self._term_proc and self._term_proc.poll() is None
                    
                    if not shell_active:
                        # Last flush
                        chunk = ring_buffer.pop_all()
                        if chunk and self._window:
                            try:
                                escaped_chunk = json.dumps(chunk)
                                self._window.evaluate_js(f"if (window.onTerminalData) window.onTerminalData({escaped_chunk});")
                            except:
                                pass
                        break
                    
                    try:
                        # Dynamic throttling based on telemetry
                        throttle = self._scheduler_wrapper.get_throttle() if hasattr(self, '_scheduler_wrapper') else 0.0
                        sleep_time = 0.015 * (1.0 + throttle * 4.0) # Sleep up to 75ms under load
                        time.sleep(sleep_time)
                        
                        chunk = ring_buffer.pop_all()
                        if chunk and self._window:
                            try:
                                escaped_chunk = json.dumps(chunk)
                                self._window.evaluate_js(f"if (window.onTerminalData) window.onTerminalData({escaped_chunk});")
                            except Exception as js_err:
                                print("Terminal output JS evaluation failed:", js_err)
                    except Exception as loop_err:
                        print("Terminal output flush loop error:", loop_err)
                        break

            threading.Thread(target=read_stream, args=(self._term_proc.stdout,), daemon=True).start()
            threading.Thread(target=read_stream, args=(self._term_proc.stderr,), daemon=True).start()
            threading.Thread(target=flush_buffer, daemon=True).start()

        except Exception as e:
            # Fallback output warning to console and UI
            print("Failed to spawn PowerShell:", e)
            if hasattr(self, '_window') and self._window:
                try:
                    escaped_err = json.dumps(f"\r\n\x1b[31m[HyperDrive] Failed to spawn terminal: {e}\x1b[0m\r\n")
                    self._window.evaluate_js(f"if (window.onTerminalData) window.onTerminalData({escaped_err});")
                except:
                    pass

    def write_terminal_data(self, data):
        if hasattr(self, '_term_proc') and self._term_proc:
            if self._term_proc.poll() is not None:
                return # Process is dead
            if self._term_proc.stdin:
                try:
                    self._term_proc.stdin.write(data)
                    self._term_proc.stdin.flush()
                except OSError as e:
                    print("Failed to write stdin to shell (Broken Pipe):", e)
                except Exception as e:
                    print("Failed to write stdin to shell:", e)

    def resize_terminal(self, cols, rows):
        # Stub for terminal resizing (PowerShell Popen doesn't support easy PTY resizing natively without ConPTY)
        pass































def main():
    if getattr(sys, 'frozen', False):
        # Change working directory to temp folder where assets are stored
        os.chdir(sys._MEIPASS)

    api = HyperDriveAPI()
    
    # Configure custom window settings matching design specifications
    window = webview.create_window(
        title="HyperDrive",
        url="www/index.html", # Relative path triggers pywebview local HTTP server
        js_api=api,
        width=1000,
        height=700,
        resizable=True,
        min_size=(800, 600),
        background_color="#0d0f14", # Charcoal pitch background
        frameless=True, # Make window frameless (borderless)
        easy_drag=False # Drag window via pywebview-drag-region HTML class
    )
    api.set_window(window)
    
    # Run using chromium WebView2 on Windows with persistent storage path
    app_data_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive")
    os.makedirs(app_data_dir, exist_ok=True)
    webview.start(storage_path=app_data_dir, private_mode=False, debug=False)

if __name__ == "__main__":
    main()
