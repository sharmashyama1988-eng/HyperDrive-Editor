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



class HyperDriveAPI:
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

    def start_preview_server(self, workspace_path):
        import socket
        import http.server
        import socketserver
        
        if not workspace_path or not os.path.exists(workspace_path):
            return None
            
        # Re-use existing server if serving same folder
        if self.preview_server and self.preview_dir == workspace_path:
            return self.preview_port
            
        self.stop_preview_server()
        
        self.preview_dir = workspace_path
        
        # Find a free port
        def find_free_port():
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
            s.close()
            return port
            
        self.preview_port = find_free_port()
        
        class WorkspaceHTTPHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=workspace_path, **kwargs)
                
            def end_headers(self):
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
                super().end_headers()
                
            def log_message(self, format, *args):
                pass
                
        class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
            allow_reuse_address = True
            
        def run_server():
            try:
                self.preview_server = ThreadedHTTPServer(('127.0.0.1', self.preview_port), WorkspaceHTTPHandler)
                self.preview_server.serve_forever()
            except Exception as e:
                print("Local preview HTTP server run exception:", e)
                
        threading.Thread(target=run_server, daemon=True).start()
        print(f"Local preview HTTP server started at 127.0.0.1:{self.preview_port} for {workspace_path}")
        return self.preview_port

    def stop_preview_server(self):
        if self.preview_server:
            try:
                self.preview_server.shutdown()
                self.preview_server.server_close()
            except:
                pass
            self.preview_server = None
            self.preview_port = None
            self.preview_dir = None

    def get_preview_url(self, file_path):
        try:
            if not file_path:
                return ""
            file_path = file_path.replace("\\", "/")
            
            workspace = self.workspace_path
            if not workspace:
                workspace = os.path.dirname(file_path)
                
            port = self.start_preview_server(workspace)
            if not port:
                return ""
                
            rel_path = os.path.relpath(file_path, workspace).replace("\\", "/")
            return f"http://127.0.0.1:{port}/{rel_path}"
        except Exception as e:
            print("Failed to resolve local preview URL:", e)
            return ""

    def search_workspace(self, query, workspace_path):
        try:
            if not workspace_path or not os.path.exists(workspace_path):
                return []
                
            query = query.lower()
            results = []
            max_results = 200
            
            exclude_dirs = {'.git', 'node_modules', '.tauri', 'build', 'dist', '__pycache__', '.hyperdrive'}
            exclude_exts = {
                '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', 
                '.mp4', '.mp3', '.exe', '.dll', '.bin', '.pdb', '.woff', '.woff2', 
                '.ttf', '.eot', '.class', '.o', '.obj'
            }
            
            for root, dirs, files in os.walk(workspace_path):
                # Filter directories in-place to prevent scanning excluded folders
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in exclude_exts:
                        continue
                        
                    full_path = os.path.join(root, file).replace("\\", "/")
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                            for idx, line in enumerate(f, 1):
                                if query in line.lower():
                                    results.append({
                                        "path": full_path,
                                        "name": file,
                                        "line": idx,
                                        "content": line.strip()
                                    })
                                    if len(results) >= max_results:
                                        return results
                    except:
                        continue
            return results
        except Exception as e:
            print("search_workspace Python error:", e)
            return []

    def get_extensions_dir(self):
        ext_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "extensions")
        os.makedirs(ext_dir, exist_ok=True)
        return ext_dir

    def install_vsix(self, vsix_path):
        import zipfile
        import shutil
        try:
            if not os.path.exists(vsix_path):
                return {"error": "VSIX file does not exist."}

            dest_dir = self.get_extensions_dir()
            
            with zipfile.ZipFile(vsix_path, 'r') as zip_ref:
                manifest_data = None
                try:
                    manifest_data = json.loads(zip_ref.read('extension/package.json').decode('utf-8'))
                except Exception as e:
                    return {"error": f"Failed to parse extension/package.json inside VSIX: {str(e)}"}

                publisher = manifest_data.get("publisher", "unknown")
                name = manifest_data.get("name", "unknown")
                version = manifest_data.get("version", "1.0.0")
                folder_name = f"{publisher}.{name}-{version}"
                
                target_folder = os.path.join(dest_dir, folder_name)
                if os.path.exists(target_folder):
                    shutil.rmtree(target_folder)
                os.makedirs(target_folder, exist_ok=True)

                # Extract only files in the extension/ directory
                for file_info in zip_ref.infolist():
                    if file_info.filename.startswith('extension/'):
                        rel_path = os.path.relpath(file_info.filename, 'extension')
                        dest_file_path = os.path.join(target_folder, rel_path)
                        
                        if file_info.is_dir():
                            os.makedirs(dest_file_path, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
                            with zip_ref.open(file_info) as source, open(dest_file_path, "wb") as target:
                                shutil.copyfileobj(source, target)
                                
            return {"success": True, "extension": {
                "id": f"{publisher}.{name}",
                "name": manifest_data.get("displayName", name),
                "version": version,
                "publisher": publisher,
                "description": manifest_data.get("description", "")
            }}
        except Exception as e:
            return {"error": str(e)}

    def list_installed_extensions(self):
        try:
            dest_dir = self.get_extensions_dir()
            results = []
            if os.path.exists(dest_dir):
                for folder in os.listdir(dest_dir):
                    folder_path = os.path.join(dest_dir, folder)
                    pkg_json = os.path.join(folder_path, "package.json")
                    if os.path.isdir(folder_path) and os.path.exists(pkg_json):
                        try:
                            with open(pkg_json, "r", encoding="utf-8") as f:
                                manifest = json.load(f)
                            results.append({
                                "id": f"{manifest.get('publisher', 'unknown')}.{manifest.get('name', 'unknown')}",
                                "name": manifest.get("displayName", manifest.get("name")),
                                "version": manifest.get("version", "1.0.0"),
                                "publisher": manifest.get("publisher", "unknown"),
                                "description": manifest.get("description", ""),
                                "folder_path": folder_path.replace("\\", "/")
                            })
                        except:
                            pass
            return results
        except Exception as e:
            return {"error": str(e)}

    def get_extension_contributions(self):
        try:
            dest_dir = self.get_extensions_dir()
            contributions = {
                "themes": [],
                "snippets": [],
                "languages": [],
                "grammars": []
            }
            
            if os.path.exists(dest_dir):
                for folder in os.listdir(dest_dir):
                    folder_path = os.path.join(dest_dir, folder)
                    pkg_json = os.path.join(folder_path, "package.json")
                    if os.path.isdir(folder_path) and os.path.exists(pkg_json):
                        try:
                            with open(pkg_json, "r", encoding="utf-8") as f:
                                manifest = json.load(f)
                            
                            contrib = manifest.get("contributes", {})
                            
                            # 1. Themes
                            for theme in contrib.get("themes", []):
                                theme_path = os.path.join(folder_path, theme.get("path", "")).replace("\\", "/")
                                if os.path.exists(theme_path):
                                    try:
                                        with open(theme_path, "r", encoding="utf-8") as tf:
                                            theme_content = tf.read()
                                            import re
                                            theme_content_clean = re.sub(r'//.*', '', theme_content)
                                            theme_content_clean = re.sub(r'/\*.*?\*/', '', theme_content_clean, flags=re.DOTALL)
                                            theme_data = json.loads(theme_content_clean)
                                            
                                            contributions["themes"].append({
                                                "label": theme.get("label", ""),
                                                "uiTheme": theme.get("uiTheme", "vs-dark"),
                                                "colors": theme_data.get("colors", {}),
                                                "tokenColors": theme_data.get("tokenColors", [])
                                            })
                                    except Exception as e:
                                        print("Failed to parse theme file:", theme_path, e)
                                        
                            # 2. Snippets
                            for snippet in contrib.get("snippets", []):
                                snip_path = os.path.join(folder_path, snippet.get("path", "")).replace("\\", "/")
                                if os.path.exists(snip_path):
                                    try:
                                        with open(snip_path, "r", encoding="utf-8") as sf:
                                            snippet_content = sf.read()
                                            import re
                                            snippet_content_clean = re.sub(r'//.*', '', snippet_content)
                                            snippet_content_clean = re.sub(r'/\*.*?\*/', '', snippet_content_clean, flags=re.DOTALL)
                                            snippet_data = json.loads(snippet_content_clean)
                                            
                                            contributions["snippets"].append({
                                                "language": snippet.get("language", ""),
                                                "snippets": snippet_data
                                            })
                                    except Exception as e:
                                        print("Failed to parse snippet file:", snip_path, e)
                                        
                            # 3. Languages
                            for lang in contrib.get("languages", []):
                                contributions["languages"].append({
                                    "id": lang.get("id", ""),
                                    "extensions": lang.get("extensions", []),
                                    "aliases": lang.get("aliases", [])
                                })
                                
                            # 4. Grammars
                            for grammar in contrib.get("grammars", []):
                                gram_path = os.path.join(folder_path, grammar.get("path", "")).replace("\\", "/")
                                contributions["grammars"].append({
                                    "language": grammar.get("language", ""),
                                    "scopeName": grammar.get("scopeName", ""),
                                    "path": gram_path
                                })
                        except Exception as e:
                            print("Error reading package.json for contributions:", folder, e)
            return contributions
        except Exception as e:
            print("get_extension_contributions error:", e)
            return {"error": str(e)}

    def search_online_extensions(self, query):
        import urllib.request
        import urllib.parse
        try:
            if not query:
                return []
            encoded_query = urllib.parse.quote(query)
            url = f"https://open-vsx.org/api/-/search?q={encoded_query}"
            
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode('utf-8'))
                
            results = []
            extensions_list = data.get("results", [])
            for ext in extensions_list:
                namespace = ext.get("namespace", "")
                name = ext.get("name", "")
                version = ext.get("version", "")
                display_name = ext.get("displayName", name)
                description = ext.get("description", "")
                downloads = ext.get("downloads", 0)
                
                download_url = f"https://open-vsx.org/api/{namespace}/{name}/{version}/file/{namespace}.{name}-{version}.vsix"
                
                results.append({
                    "id": f"{namespace}.{name}",
                    "name": display_name,
                    "publisher": namespace,
                    "version": version,
                    "description": description,
                    "downloads": downloads,
                    "download_url": download_url
                })
            return results
        except Exception as e:
            print("search_online_extensions error:", e)
            return {"error": str(e)}

    def download_and_install_extension(self, download_url):
        import urllib.request
        import tempfile
        try:
            temp_dir = tempfile.gettempdir()
            temp_file_path = os.path.join(temp_dir, "temp_extension.vsix")
            
            req = urllib.request.Request(
                download_url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=60) as response, open(temp_file_path, 'wb') as out_file:
                out_file.write(response.read())
                
            result = self.install_vsix(temp_file_path)
            
            try:
                os.remove(temp_file_path)
            except:
                pass
                
            return result
        except Exception as e:
            print("download_and_install_extension error:", e)
            return {"error": str(e)}

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

    def ai_quick_fix(self, file_content, file_language, errors_json, api_key, api_type="gemini", api_base="", model_name="gemini-1.5-flash"):
        try:
            errors = json.loads(errors_json)
            errors_str = "\n".join([f"Line {e.get('line')}, Col {e.get('col')}: {e.get('message')}" for e in errors])
            
            prompt = (
                f"You are a production-grade automated compiler error fixer.\n"
                f"Language: {file_language}\n"
                f"Errors to fix:\n{errors_str}\n\n"
                f"Original File Content:\n{file_content}\n\n"
                f"INSTRUCTIONS:\n"
                f"1. Fix only the syntax errors mentioned above. Do not alter any other logic or variables.\n"
                f"2. Output the complete, updated file content.\n"
                f"3. ZERO CHITCHAT: Output ONLY the raw corrected file contents. Do not include markdown codeblocks (like ```python) or explanations.\n"
            )
            
            # Clean api_base URL
            api_base = api_base.strip() if api_base else ""
            if not api_base:
                api_base = "https://openrouter.ai/api/v1"
            
            if api_type == "openai" or api_type == "ollama":
                res = self._post_openai(api_key, api_base, model_name, [{"role": "user", "content": prompt}])
                choices = res.get("choices", [])
                if not choices:
                    return {"error": "No response returned by OpenAI model."}
                corrected = choices[0].get("message", {}).get("content", "")
            else:
                res = self._post_gemini(api_key, model_name, [{"role": "user", "parts": [{"text": prompt}]}], "You are an automated compiler code fixer.")
                candidates = res.get("candidates", [])
                if not candidates:
                    return {"error": "No response returned by Gemini model."}
                parts = candidates[0].get("content", {}).get("parts", [])
                corrected = "".join([p.get("text", "") for p in parts])
                
            # Clean potential markdown block formatting from model response
            corrected_clean = corrected.strip()
            if corrected_clean.startswith("```"):
                lines = corrected_clean.splitlines()
                if len(lines) > 2:
                    corrected_clean = "\n".join(lines[1:-1])
                    
            return {"success": True, "corrected": corrected_clean}
        except Exception as e:
            return {"error": str(e)}

    def select_folder(self):
        try:
            if not self._window:
                return None
            res = self._window.create_file_dialog(webview.FOLDER_DIALOG)
            if res and len(res) > 0:
                return res[0].replace("\\", "/")
            return None
        except Exception as e:
            return {"error": str(e)}

    def select_file(self, file_types=('All files (*.*)',)):
        """Open a native single-file selection dialog."""
        try:
            if not self._window:
                return None
            res = self._window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=file_types
            )
            if res and len(res) > 0:
                return res[0].replace("\\", "/")
            return None
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
            # Fallback output warning to console
            print("Failed to spawn PowerShell:", e)

    def write_terminal_data(self, data):
        if hasattr(self, '_term_proc') and self._term_proc and self._term_proc.stdin:
            try:
                self._term_proc.stdin.write(data)
                self._term_proc.stdin.flush()
            except Exception as e:
                print("Failed to write stdin to shell:", e)

    def read_dir_recursive(self, dir_path):
        try:
            if not os.path.exists(dir_path):
                return {"error": "Directory does not exist"}
            
            result = []
            for entry in os.scandir(dir_path):
                result.append({
                    "name": entry.name,
                    "path": entry.path.replace("\\", "/"),
                    "is_dir": entry.is_dir()
                })
            
            # Sort: Directories first, then alphabetically
            result.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
            return result
        except Exception as e:
            return {"error": str(e)}

    def read_file(self, file_path):
        try:
            # Normalize path for training consistency
            normalized_path = os.path.normpath(file_path).replace("\\", "/")
            
            # Train prefetcher transitions
            if hasattr(self, '_last_file_opened') and self._last_file_opened:
                if self._last_file_opened != normalized_path:
                    self.prefetcher.train(self._last_file_opened, normalized_path)
            self._last_file_opened = normalized_path
            
            # Predict and warm the next file in a background thread
            predicted = self.prefetcher.predict(normalized_path)
            if predicted and os.path.exists(predicted):
                def warm_cache(path):
                    try:
                        with open(path, "r", encoding="utf-8") as wf:
                            wf.read(1024) # Warm OS cache / read buffer
                    except:
                        pass
                threading.Thread(target=warm_cache, args=(predicted,), daemon=True).start()

            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return {"error": str(e)}

    def write_file(self, file_path, content):
        try:
            # Ensure folder directory path exists
            dir_name = os.path.dirname(file_path)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def mkdir(self, dir_path):
        try:
            os.makedirs(dir_path, exist_ok=True)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def rename_item(self, old_path, new_path):
        try:
            if not os.path.exists(old_path):
                return {"error": "Source path does not exist"}
            target_dir = os.path.dirname(new_path)
            if target_dir:
                os.makedirs(target_dir, exist_ok=True)
            os.rename(old_path, new_path)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def delete_item(self, item_path):
        try:
            if not os.path.exists(item_path):
                return {"error": "Path does not exist"}
            if os.path.isdir(item_path):
                import shutil
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def reveal_in_explorer(self, file_path):
        try:
            norm_path = os.path.normpath(file_path)
            if os.path.exists(norm_path):
                if os.path.isdir(norm_path):
                    subprocess.Popen(f'explorer.exe "{norm_path}"')
                else:
                    subprocess.Popen(f'explorer.exe /select,"{norm_path}"')
                return {"success": True}
            return {"error": "File does not exist"}
        except Exception as e:
            return {"error": str(e)}


    def git_diff_summary(self, repo_path):
        try:
            added = 0
            deleted = 0
            modified = 0
            
            res = subprocess.run(
                ["git", "diff", "--numstat"], 
                cwd=repo_path, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True, 
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 3:
                        added += int(parts[0])
                        deleted += int(parts[1])
            return f"+{added},-{deleted},~{modified}"
        except:
            return "+0,-0,~0"

    def git_status(self, repo_path):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
            
            dot_git = os.path.join(repo_path, ".git")
            if not os.path.exists(dot_git):
                return {"is_repo": False}
                
            # Get branch name
            res_branch = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            branch = res_branch.stdout.strip() or "main"
            
            # Get status files
            res_status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            files = []
            for line in res_status.stdout.splitlines():
                if len(line) < 4:
                    continue
                code = line[:2]
                path = line[3:]
                name = os.path.basename(path)
                
                status = "modified"
                if "A" in code or "?" in code:
                    status = "added"
                elif "D" in code:
                    status = "deleted"
                    
                files.append({
                    "path": path.replace("\\", "/"),
                    "name": name,
                    "status": status
                })
                
            return {
                "is_repo": True,
                "branch": branch,
                "files": files
            }
        except Exception as e:
            return {"error": str(e)}

    def git_commit(self, repo_path, message, email=None, name=None):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
                
            if name:
                subprocess.run(
                    ["git", "config", "--local", "user.name", name],
                    cwd=repo_path,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
            if email:
                subprocess.run(
                    ["git", "config", "--local", "user.email", email],
                    cwd=repo_path,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
                
            subprocess.run(
                ["git", "add", "-A"],
                cwd=repo_path,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            res = subprocess.run(
                ["git", "commit", "-m", message],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if res.returncode != 0:
                return {"error": res.stderr.strip() or res.stdout.strip()}
                
            return {"success": True, "output": res.stdout.strip()}
        except Exception as e:
            return {"error": str(e)}

    def git_sync(self, repo_path, username=None, token=None):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
                
            res_remote = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if res_remote.returncode != 0:
                return {"error": "No remote repository 'origin' configured. Set remote origin URL first."}
                
            origin_url = res_remote.stdout.strip()
            
            res_branch = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            branch = res_branch.stdout.strip() or "main"
            
            if username and token:
                clean_url = origin_url
                for prefix in ["https://", "http://"]:
                    if clean_url.startswith(prefix):
                        clean_url = clean_url[len(prefix):]
                
                if "@" in clean_url:
                    clean_url = clean_url.split("@", 1)[1]
                    
                authed_url = f"https://{username}:{token}@{clean_url}"
                
                subprocess.run(
                    ["git", "remote", "set-url", "origin", authed_url],
                    cwd=repo_path,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
            
            pull_res = subprocess.run(
                ["git", "pull", "origin", branch],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            push_res = subprocess.run(
                ["git", "push", "origin", branch],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            output = f"Pull Output:\n{pull_res.stdout}\n{pull_res.stderr}\n\nPush Output:\n{push_res.stdout}\n{push_res.stderr}"
            
            if push_res.returncode != 0:
                return {"error": push_res.stderr.strip() or "Failed to push to GitHub.", "output": output}
                
            return {"success": True, "output": output}
        except Exception as e:
            return {"error": str(e)}

    def git_init(self, repo_path):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
            res = subprocess.run(
                ["git", "init"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            if res.returncode != 0:
                return {"error": res.stderr.strip()}
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def _get_project_ai_dir(self, repo_path):
        import hashlib
        if not repo_path:
            repo_path = "default_project"
        norm_path = os.path.normpath(repo_path).replace("\\", "/").strip()
        if norm_path.endswith("/") and len(norm_path) > 3:
            norm_path = norm_path[:-1]
        norm_path = norm_path.lower()
        project_id = hashlib.md5(norm_path.encode('utf-8')).hexdigest()
        
        ai_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "projects", project_id, "ai")
        os.makedirs(ai_dir, exist_ok=True)
        return ai_dir

    def _parse_json_tool_call(self, text):
        if not text:
            return None
        text_clean = text.strip()
        start = text_clean.find('{')
        end = text_clean.rfind('}')
        if start != -1 and end != -1 and end > start:
            json_str = text_clean[start:end+1]
            try:
                data = json.loads(json_str)
                if "tool_name" in data:
                    return data
            except:
                pass
        return None

    def pull_ollama_model(self, model_name):
        import urllib.request
        import urllib.error
        import json
        import threading
        
        def run_pull():
            self._send_agent_status("status", f"Checking Ollama for {model_name}...")
            url = "http://localhost:11434/api/pull"
            body = {"name": model_name, "stream": True}
            
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            try:
                with urllib.request.urlopen(req) as response:
                    for line in response:
                        if not line:
                            continue
                        try:
                            status_obj = json.loads(line.decode("utf-8"))
                            status_text = status_obj.get("status", "")
                            
                            # Parse progress percentage
                            total = status_obj.get("total", 0)
                            completed = status_obj.get("completed", 0)
                            if total > 0:
                                pct = int((completed / total) * 100)
                                self._send_agent_status("status", f"Downloading {model_name}: {pct}% ({status_text})")
                            else:
                                self._send_agent_status("status", f"Ollama: {status_text}")
                        except Exception as e:
                            pass
                self._send_agent_status("status", f"✓ {model_name} ready!")
                if self._window:
                    self._window.evaluate_js(f"if (window.onOllamaPullComplete) window.onOllamaPullComplete('{model_name}', true);")
            except urllib.error.URLError as e:
                self._send_agent_status("status", "Ollama not running. Please start Ollama first.")
                if self._window:
                    self._window.evaluate_js(f"if (window.onOllamaPullComplete) window.onOllamaPullComplete('{model_name}', false, 'Ollama server not running. Please start Ollama desktop app.');")
            except Exception as e:
                self._send_agent_status("status", f"Ollama Pull Error: {str(e)}")
                if self._window:
                    self._window.evaluate_js(f"if (window.onOllamaPullComplete) window.onOllamaPullComplete('{model_name}', false, {json.dumps(str(e))});")

        threading.Thread(target=run_pull, daemon=True).start()
        return {"success": True, "message": "Pull thread started."}

    def reveal_project_ai_dir(self, repo_path):
        try:
            ai_dir = self._get_project_ai_dir(repo_path)
            norm_path = os.path.normpath(ai_dir)
            if os.path.exists(norm_path):
                subprocess.Popen(f'explorer.exe "{norm_path}"')
                return {"success": True}
            return {"error": "Directory does not exist"}
        except Exception as e:
            return {"error": str(e)}

    def init_ai_workspace(self, repo_path):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
                
            ai_dir = self._get_project_ai_dir(repo_path)
            
            skills_dir = os.path.join(ai_dir, "skills")
            os.makedirs(skills_dir, exist_ok=True)
            
            scripts_dir = os.path.join(skills_dir, "scripts")
            os.makedirs(scripts_dir, exist_ok=True)
            
            # Create default rules.md
            rules_path = os.path.join(ai_dir, "rules.md")
            if not os.path.exists(rules_path):
                with open(rules_path, "w", encoding="utf-8") as f:
                    f.write("# HyperDrive AI Rules\n\n- You are an expert developer assistant operating in HyperDrive.\n- Write clean, modular, and optimized code.\n- Follow best practices for the active programming language.\n")
                    
            # Create template skill JSON
            example_skill_json = os.path.join(skills_dir, "greet_user.json")
            if not os.path.exists(example_skill_json):
                with open(example_skill_json, "w", encoding="utf-8") as f:
                    json.dump({
                        "name": "greet_user",
                        "description": "Greets the user with their name and custom message",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING", "description": "The user's name"},
                                "message": {"type": "STRING", "description": "A custom greeting message"}
                            },
                            "required": ["name"]
                        },
                        "script": "greet.py"
                    }, f, indent=4)
                    
            # Create template script
            example_script = os.path.join(scripts_dir, "greet.py")
            if not os.path.exists(example_script):
                with open(example_script, "w", encoding="utf-8") as f:
                    f.write("import sys\nimport json\n\ntry:\n    args = json.load(sys.stdin)\n    name = args.get('name', 'Developer')\n    msg = args.get('message', 'Happy Coding!')\n    print(f'Hello {name}! {msg}')\nexcept Exception as e:\n    print(f'Error running skill: {str(e)}')\n")

            # ── Initialize Global Skills Folder ──
            global_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "skills")
            global_scripts_dir = os.path.join(global_dir, "scripts")
            os.makedirs(global_scripts_dir, exist_ok=True)

            example_global_json = os.path.join(global_dir, "greet_global.json")
            if not os.path.exists(example_global_json):
                with open(example_global_json, "w", encoding="utf-8") as f:
                    json.dump({
                        "name": "greet_global",
                        "description": "Greets user globally across any project",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING", "description": "The user's name"}
                            },
                            "required": ["name"]
                        },
                        "script": "greet_global.py"
                    }, f, indent=4)

            example_global_script = os.path.join(global_scripts_dir, "greet_global.py")
            if not os.path.exists(example_global_script):
                with open(example_global_script, "w", encoding="utf-8") as f:
                    f.write("import sys\nimport json\n\ntry:\n    args = json.load(sys.stdin)\n    name = args.get('name', 'Developer')\n    print(f'Hello {name}! This is a global skill available in any workspace.')\nexcept Exception as e:\n    print(f'Error running global skill: {str(e)}')\n")
                    
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def run_agent_loop(self, prompt, api_key, repo_path, messages_json, api_type="gemini", api_base="", model_name="gemini-1.5-flash"):
        import threading
        threading.Thread(
            target=self._run_agent_thread,
            args=(prompt, api_key, repo_path, messages_json, api_type, api_base, model_name),
            daemon=True
        ).start()

    def _run_agent_thread(self, prompt, api_key, repo_path, messages_json, api_type="gemini", api_base="", model_name="gemini-1.5-flash"):
        import urllib.parse
        import urllib.request
        import urllib.error
        try:
            # 1. Load Rules from rules.md (Global + Workspace)
            global_rules_path = os.path.join(os.path.expanduser("~"), ".hyperdrive", "rules.md")
            workspace_rules_path = os.path.join(self._get_project_ai_dir(repo_path), "rules.md")
            
            # Ensure global rules file exists
            if not os.path.exists(global_rules_path):
                with open(global_rules_path, "w", encoding="utf-8") as f:
                    f.write("# Global HyperDrive AI Rules\n\n- You are operating inside the HyperDrive Editor.\n- Enforce strict typing, clean modular design, and robust error handling.\n- When generating files, output complete, production-ready code without placeholders.\n")

            global_rules = ""
            if os.path.exists(global_rules_path):
                with open(global_rules_path, "r", encoding="utf-8") as f:
                    global_rules = f.read()
                    
            workspace_rules = ""
            if os.path.exists(workspace_rules_path):
                with open(workspace_rules_path, "r", encoding="utf-8") as f:
                    workspace_rules = f.read()

            system_instruction = (
                "You are Hyperdrive AI, the core multi-agent orchestration engine of the Hyperdrive code editor. "
                "Your absolute priority is extreme speed, zero token waste, and executing precise code modifications.\n\n"
                "OPERATING RULES:\n"
                "1. ZERO CHITCHAT: You are a machine. Never output conversational filler, greetings, or explanations outside the JSON structure.\n"
                "2. TOOL-DRIVEN EXECUTION: You cannot magically alter files. You must emit JSON commands to use your tools.\n"
                "3. VERIFY FIRST: Never guess line numbers or variable names. Always use `read_file` or `search_codebase` before making modifications.\n"
                "4. DIFF-ONLY EDITS: When modifying code, never rewrite the entire file. Only provide the exact block to be replaced and the new block.\n"
                "5. ONE ACTION PER TURN: Execute one logical step at a time. Read the output from the previous tool before deciding the next step.\n\n"
                "AVAILABLE TOOLS:\n"
                "- `read_file`: {\"path\": \"string\"} -> Returns file content.\n"
                "- `search_codebase`: {\"query\": \"string\"} -> Returns AST/Vector search results.\n"
                "- `run_terminal`: {\"command\": \"string\"} -> Executes shell commands.\n"
                "- `edit_code`: {\"path\": \"string\", \"search_block\": \"exact code to replace\", \"replace_block\": \"new code\"} -> Modifies files.\n"
                "- `task_complete`: {\"message\": \"string\"} -> Signals the backend that the user's request is fulfilled.\n\n"
                "OUTPUT FORMAT:\n"
                "Every response must be a single, valid JSON object in this exact structure:\n"
                "{\n"
                "  \"thought\": \"Brief, 1-sentence logical reason for the current step.\",\n"
                "  \"tool_name\": \"name of the tool\",\n"
                "  \"tool_args\": {\n"
                "    // arguments required for the tool\n"
                "  }\n"
                "}\n\n"
                "Current workspace directory: " + repo_path
            )
            
            if global_rules:
                system_instruction += "\n\nFollow these global rules:\n" + global_rules
            if workspace_rules:
                system_instruction += "\n\nFollow these project-specific rules:\n" + workspace_rules

            # 2. Build Default Tools
            declarations = [
                {
                    "name": "read_file",
                    "description": "Reads the content of a file in the workspace.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "file_path": {"type": "STRING", "description": "Workspace-relative path to the file"},
                            "path": {"type": "STRING", "description": "Workspace-relative path to the file (alternative)"}
                        }
                    }
                },
                {
                    "name": "write_file",
                    "description": "Creates or overwrites a file in the workspace with complete content.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "file_path": {"type": "STRING", "description": "Workspace-relative path to write"},
                            "content": {"type": "STRING", "description": "The full code/text content to write"}
                        },
                        "required": ["file_path", "content"]
                    }
                },
                {
                    "name": "list_dir",
                    "description": "Lists the files and folders in a workspace directory.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "dir_path": {"type": "STRING", "description": "Workspace-relative directory path (empty string for root)"}
                        },
                        "required": ["dir_path"]
                    }
                },
                {
                    "name": "run_command",
                    "description": "Runs a terminal command or script inside the workspace directory.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "command": {"type": "STRING", "description": "The command string to execute"}
                        },
                        "required": ["command"]
                    }
                },
                {
                    "name": "web_search",
                    "description": "Searches the web for recent information, documentation, or answers.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "query": {"type": "STRING", "description": "Search query"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "web_browse",
                    "description": "Browses a URL and returns visible text for research.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "url": {"type": "STRING", "description": "The target URL"}
                        },
                        "required": ["url"]
                    }
                },
                {
                    "name": "search_codebase",
                    "description": "Searches the codebase recursively for specific text query.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "query": {"type": "STRING", "description": "Text query to search for"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "edit_code",
                    "description": "Replaces an exact search block of code with a new block of code in a file.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "path": {"type": "STRING", "description": "Workspace-relative file path"},
                            "search_block": {"type": "STRING", "description": "Exact text/code to find/replace"},
                            "replace_block": {"type": "STRING", "description": "New code/text content to place"}
                        },
                        "required": ["path", "search_block", "replace_block"]
                    }
                },
                {
                    "name": "run_terminal",
                    "description": "Executes shell commands in the workspace.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "command": {"type": "STRING", "description": "The command string to execute"}
                        },
                        "required": ["command"]
                    }
                },
                {
                    "name": "task_complete",
                    "description": "Signals that the user's task has been successfully fulfilled.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "message": {"type": "STRING", "description": "Completion message"}
                        },
                        "required": ["message"]
                    }
                }
            ]

            # 3. Scan & Load Custom Skills (Global + Workspace)
            custom_skills_map = {}
            
            def load_skills_from_dir(directory, is_global):
                if os.path.exists(directory):
                    for f_name in os.listdir(directory):
                        if f_name.endswith(".json"):
                            try:
                                with open(os.path.join(directory, f_name), "r", encoding="utf-8") as sf:
                                    skill = json.load(sf)
                                    if "name" in skill and "description" in skill:
                                        # Deduplicate in declarations
                                        declarations[:] = [d for d in declarations if d["name"] != skill["name"]]
                                        declarations.append({
                                            "name": skill["name"],
                                            "description": skill["description"],
                                            "parameters": skill.get("parameters", {"type": "OBJECT", "properties": {}})
                                        })
                                        s_name = skill.get("script", "")
                                        if is_global:
                                            s_path = os.path.join(os.path.expanduser("~"), ".hyperdrive", "skills", "scripts", s_name)
                                        else:
                                            s_path = os.path.join(self._get_project_ai_dir(repo_path), "skills", "scripts", s_name)
                                        
                                        custom_skills_map[skill["name"]] = {
                                            "script_path": s_path,
                                            "definition": skill
                                        }
                            except Exception as ex:
                                print("Error loading skill json:", f_name, ex)

            # Load global first, then workspace (which will override global of the same name)
            global_skills_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "skills")
            load_skills_from_dir(global_skills_dir, is_global=True)
            workspace_skills_dir = os.path.join(self._get_project_ai_dir(repo_path), "skills")
            load_skills_from_dir(workspace_skills_dir, is_global=False)

            # 4. Agent Execution Loop (Gemini vs OpenAI-Compatible)
            history = json.loads(messages_json)
            loop_count = 0
            max_loops = 15

            if api_type == "openai" or api_type == "ollama":
                # Convert declarations to OpenAI tools format
                openai_tools = [
                    {
                        "type": "function",
                        "function": {
                            "name": dec["name"],
                            "description": dec["description"],
                            "parameters": dec.get("parameters", {"type": "OBJECT", "properties": {}})
                        }
                    }
                    for dec in declarations
                ]
                
                openai_messages = [{"role": "system", "content": system_instruction}]
                for msg in history:
                    role = msg.get("role")
                    content = msg.get("content", "")
                    if role == "assistant" or role == "model":
                        openai_messages.append({"role": "assistant", "content": content})
                    else:
                        openai_messages.append({"role": "user", "content": content})
                
                # Current user prompt
                openai_messages.append({"role": "user", "content": prompt})

                while loop_count < max_loops:
                    loop_count += 1
                    self._send_agent_status("status", f"Invoking Model (Turn {loop_count})...")
                    
                    res = self._post_openai(api_key, api_base, model_name, openai_messages, openai_tools)
                    
                    choices = res.get("choices", [])
                    if not choices:
                        raise Exception("No choices returned by LLM: " + json.dumps(res))
                        
                    message_obj = choices[0].get("message", {})
                    content = message_obj.get("content")
                    tool_calls = message_obj.get("tool_calls", [])
                    
                    openai_messages.append(message_obj)
                    
                    # Check for JSON formatted tool calls in text
                    json_call = self._parse_json_tool_call(content)
                    if json_call:
                        tool_name = json_call.get("tool_name")
                        tool_args = json_call.get("tool_args", {})
                        
                        if tool_name == "task_complete":
                            final_msg = tool_args.get("message", "")
                            if final_msg:
                                self._send_agent_status("token", final_msg)
                            self._send_agent_status("status", "✓ Task completed")
                            break
                            
                        self._send_agent_status("status", f"🔧 Running tool: {tool_name}")
                        result = self._execute_tool(tool_name, tool_args, repo_path, custom_skills_map)
                        self._send_agent_status("status", f"✓ Tool {tool_name} finished.")
                        
                        openai_messages.append({
                            "role": "user",
                            "content": f"Tool '{tool_name}' output:\n{result}"
                        })
                        continue
                    else:
                        # No JSON tool call, this is a plain text chatbot response!
                        if content:
                            self._send_agent_status("token", content)

                    if not tool_calls:
                        break
                        
                    for tool_call in tool_calls:
                        tc_id = tool_call.get("id")
                        func = tool_call.get("function", {})
                        f_name = func.get("name")
                        f_args_str = func.get("arguments", "{}")
                        try:
                            f_args = json.loads(f_args_str)
                        except:
                            f_args = {}
                            
                        self._send_agent_status("status", f"🔧 Running tool: {f_name}({json.dumps(f_args)})")
                        result = self._execute_tool(f_name, f_args, repo_path, custom_skills_map)
                        self._send_agent_status("status", f"✓ Tool {f_name} finished.")
                        
                        openai_messages.append({
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "name": f_name,
                            "content": str(result)
                        })
            else:
                # Default Gemini Tooling
                tools = [{"functionDeclarations": declarations}]
                contents = []
                for msg in history:
                    role = msg.get("role")
                    if role == "assistant":
                        role = "model"
                    
                    parts = []
                    if "content" in msg and msg["content"]:
                        parts.append({"text": msg["content"]})
                    elif "functionCall" in msg:
                        parts.append({"functionCall": msg["functionCall"]})
                    elif "functionResponse" in msg:
                        parts.append({"functionResponse": msg["functionResponse"]})
                        
                    contents.append({
                        "role": role,
                        "parts": parts
                    })

                contents.append({
                    "role": "user",
                    "parts": [{"text": prompt}]
                })

                while loop_count < max_loops:
                    loop_count += 1
                    self._send_agent_status("status", f"Invoking Gemini model (Turn {loop_count})...")
                    
                    res = self._post_gemini(api_key, model_name, contents, system_instruction, tools)
                    
                    candidates = res.get("candidates", [])
                    if not candidates:
                        raise Exception("No response candidates returned by Gemini: " + json.dumps(res))
                        
                    content_obj = candidates[0].get("content", {})
                    parts = content_obj.get("parts", [])
                    
                    contents.append({
                        "role": "model",
                        "parts": parts
                    })
                    
                    has_function = False
                    gemini_text = ""
                    for part in parts:
                        if "text" in part:
                            gemini_text += part["text"]
                        if "functionCall" in part:
                            has_function = True
                    
                    # Check for JSON formatted tool calls in text
                    if not has_function and gemini_text:
                        json_call = self._parse_json_tool_call(gemini_text)
                        if json_call:
                            tool_name = json_call.get("tool_name")
                            tool_args = json_call.get("tool_args", {})
                            
                            if tool_name == "task_complete":
                                final_msg = tool_args.get("message", "")
                                if final_msg:
                                    self._send_agent_status("token", final_msg)
                                self._send_agent_status("status", "✓ Task completed")
                                break
                                
                            self._send_agent_status("status", f"🔧 Running tool: {tool_name}")
                            result = self._execute_tool(tool_name, tool_args, repo_path, custom_skills_map)
                            self._send_agent_status("status", f"✓ Tool {tool_name} finished.")
                            
                            contents.append({
                                "role": "user",
                                "parts": [{"text": f"Tool '{tool_name}' output:\n{result}"}]
                            })
                            continue
                        else:
                            # Plain text response
                            if gemini_text:
                                self._send_agent_status("token", gemini_text)
                            
                    if not has_function:
                        break
                        
                    for part in parts:
                        if "functionCall" in part:
                            f_call = part["functionCall"]
                            f_name = f_call.get("name")
                            f_args = f_call.get("args", {})
                            
                            self._send_agent_status("status", f"🔧 Running tool: {f_name}({json.dumps(f_args)})")
                            result = self._execute_tool(f_name, f_args, repo_path, custom_skills_map)
                            self._send_agent_status("status", f"✓ Tool {f_name} finished.")
                            
                            contents.append({
                                "role": "function",
                                "parts": [{
                                    "functionResponse": {
                                        "name": f_name,
                                        "response": {"result": result}
                                    }
                                }]
                            })

            self._send_agent_status("finished", "Execution completed.")
            
        except Exception as e:
            self._send_agent_status("error", str(e))

    def _execute_tool(self, name, args, repo_path, custom_skills_map):
        try:
            if name == "read_file":
                fp = os.path.join(repo_path, args.get("file_path", "") or args.get("path", "")).replace("\\", "/")
                with open(fp, "r", encoding="utf-8") as f:
                    return f.read()
            elif name == "write_file":
                fp = os.path.join(repo_path, args.get("file_path", "") or args.get("path", "")).replace("\\", "/")
                content = args.get("content", "")
                os.makedirs(os.path.dirname(fp), exist_ok=True)
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(content)
                if self._window:
                    escaped_fp = json.dumps(fp)
                    escaped_content = json.dumps(content)
                    self._window.evaluate_js(f"if(window.editorStore) window.editorStore.openFile({escaped_fp}, {escaped_content}, {escaped_fp}.split('.').pop() || 'plaintext');")
                return "Successfully wrote file."
            elif name == "list_dir":
                dp = os.path.join(repo_path, args.get("dir_path", "") or args.get("path", "")).replace("\\", "/")
                res = []
                for entry in os.scandir(dp):
                    res.append({
                        "name": entry.name,
                        "path": entry.path.replace("\\", "/"),
                        "is_dir": entry.is_dir()
                    })
                return json.dumps(res, indent=2)
            elif name == "run_command" or name == "run_terminal":
                cmd = args.get("command", "")
                res = subprocess.run(
                    cmd,
                    cwd=repo_path,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
                return f"stdout:\n{res.stdout}\nstderr:\n{res.stderr}"
            elif name == "web_search":
                return json.dumps(self._ddg_search(args.get("query", "")))
            elif name == "web_browse":
                return self._browse_url(args.get("url", ""))
            elif name == "search_codebase":
                query = args.get("query", "")
                results = []
                for root, dirs, files in os.walk(repo_path):
                    dirs[:] = [d for d in dirs if d not in ['.git', '.hyperdrive', 'node_modules', 'dist', 'build']]
                    for file in files:
                        fp = os.path.join(root, file)
                        try:
                            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                                for line_idx, line in enumerate(f, 1):
                                    if query.lower() in line.lower():
                                        results.append({
                                            "file": os.path.relpath(fp, repo_path).replace("\\", "/"),
                                            "line": line_idx,
                                            "content": line.strip()
                                        })
                                        if len(results) >= 50:
                                            break
                        except:
                            pass
                        if len(results) >= 50:
                            break
                    if len(results) >= 50:
                        break
                return json.dumps(results, indent=2)
            elif name == "edit_code":
                fp = os.path.join(repo_path, args.get("path", "") or args.get("file_path", "")).replace("\\", "/")
                search_block = args.get("search_block", "")
                replace_block = args.get("replace_block", "")
                try:
                    with open(fp, "r", encoding="utf-8") as f:
                        content = f.read()
                    if search_block in content:
                        new_content = content.replace(search_block, replace_block)
                        with open(fp, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        if self._window:
                            escaped_fp = json.dumps(fp)
                            escaped_content = json.dumps(new_content)
                            self._window.evaluate_js(f"if(window.editorStore) window.editorStore.openFile({escaped_fp}, {escaped_content}, {escaped_fp}.split('.').pop() || 'plaintext');")
                        return "Successfully edited file."
                    else:
                        return "Error: search_block not found in file content."
                except Exception as ex:
                    return f"Error editing file: {str(ex)}"
            elif name == "task_complete":
                return f"Task completed: {args.get('message', '')}"
            elif name in custom_skills_map:
                skill_data = custom_skills_map[name]
                script_path = skill_data["script_path"]
                if not os.path.exists(script_path):
                    return f"Error: Skill script does not exist at {script_path}."
                res = subprocess.run(
                    [sys.executable, script_path],
                    cwd=repo_path,
                    input=json.dumps(args),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
                return f"Skill Output:\n{res.stdout}\n{res.stderr}"
            else:
                return f"Unknown tool: {name}"
        except Exception as e:
            return f"Error executing tool {name}: {str(e)}"

    def _post_gemini(self, api_key, model, contents, system_instruction=None, tools=None):
        import urllib.request
        import urllib.error
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        body = {"contents": contents}
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
        if tools:
            body["tools"] = tools
            
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            raise Exception(f"Gemini API Error: {err_msg}")
        except Exception as e:
            raise Exception(f"Connection Error: {str(e)}")

    def _post_openai(self, api_key, api_base, model, messages, tools=None):
        import urllib.request
        import urllib.error
        
        # Clean api_base URL
        api_base = api_base.strip() if api_base else ""
        if not api_base:
            api_base = "https://openrouter.ai/api/v1"
            
        # Ensure it ends with /chat/completions
        url = api_base
        if not url.endswith("/chat/completions"):
            if url.endswith("/"):
                url += "chat/completions"
            else:
                url += "/chat/completions"
                
        body = {
            "model": model,
            "messages": messages
        }
        if tools:
            body["tools"] = tools
            
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://github.com/HyperDrive",
                "X-Title": "HyperDrive Editor"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            raise Exception(f"API Error from {url}: {err_msg}")
        except Exception as e:
            raise Exception(f"Connection Error to {url}: {str(e)}")

    def _ddg_search(self, query):
        import urllib.request
        import urllib.parse
        try:
            url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req) as response:
                html = response.read().decode("utf-8", errors="ignore")
                import re
                snippets = re.findall(r'<a class="result__snippet" href="([^"]+)"[^>]*>([\s\S]*?)</a>', html)
                results = []
                for link, snippet in snippets[:5]:
                    snippet_clean = re.sub(r'<[^>]+>', '', snippet).strip()
                    results.append({
                        "title": "Search Result",
                        "link": link,
                        "snippet": snippet_clean
                    })
                return results
        except Exception as e:
            return [{"error": str(e)}]

    def _browse_url(self, url):
        import urllib.request
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req) as response:
                html = response.read().decode("utf-8", errors="ignore")
                import re
                html = re.sub(r'<script[\s\S]*?</script>', '', html)
                html = re.sub(r'<style[\s\S]*?</style>', '', html)
                text = re.sub(r'<[^>]+>', ' ', html)
                text = re.sub(r'\s+', ' ', text)
                return text[:4000]
        except Exception as e:
            return f"Failed to browse URL: {str(e)}"

    def _send_agent_status(self, type_name, value):
        if self._window:
            try:
                payload = json.dumps({"type": type_name, "value": value})
                self._window.evaluate_js(f"if (window.onAgentStatus) window.onAgentStatus({payload});")
            except Exception as e:
                print("Failed to send agent status via JS evaluate_js:", e)

def main():
    if getattr(sys, 'frozen', False):
        # Change working directory to temp folder where assets are stored
        os.chdir(sys._MEIPASS)

    api = HyperDriveAPI()
    
    # Configure custom window settings matching design specifications
    window = webview.create_window(
        title="HyperDrive",
        url="dist/index.html", # Relative path triggers pywebview local HTTP server
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
