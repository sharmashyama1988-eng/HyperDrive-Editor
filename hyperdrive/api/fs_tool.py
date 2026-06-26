import os
import json
import subprocess
import urllib.request
import webview
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import traceback

class FsTool:

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

    def read_dir_recursive(self, dir_path):
        try:
            if not os.path.exists(dir_path):
                return {"error": "Directory does not exist"}
            
            # Exclude folders that the editor should hide by default to keep the workspace clean
            exclude_names = {'.git', '.svn', '.hg', 'node_modules', '__pycache__', '.hyperdrive', '.DS_Store'}
            
            result = []
            for entry in os.scandir(dir_path):
                if entry.name in exclude_names:
                    continue
                
                # Optionally, hide all folders starting with '.' if desired, but 
                # some users might want to see .github or .vscode. So explicit exclusion is safer.
                
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
