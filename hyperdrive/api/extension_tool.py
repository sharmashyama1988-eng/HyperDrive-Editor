import os
import json
import subprocess
import urllib.request
import webview
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import traceback

class ExtensionTool:

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
        import ssl
        try:
            if not query:
                return []
            encoded_query = urllib.parse.quote(query)
            url = f"https://open-vsx.org/api/-/search?q={encoded_query}"
            
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(req, timeout=15, context=context) as response:
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
        import ssl
        try:
            temp_dir = tempfile.gettempdir()
            temp_file_path = os.path.join(temp_dir, "temp_extension.vsix")
            
            req = urllib.request.Request(
                download_url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(req, timeout=60, context=context) as response, open(temp_file_path, 'wb') as out_file:
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

    def install_extension(self, vsix_path):
        import zipfile
        import json
        import shutil
        try:
            if not os.path.exists(vsix_path):
                return {"error": "VSIX file not found"}
            
            ext_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "extensions")
            os.makedirs(ext_dir, exist_ok=True)
            
            # Temporary extraction path
            temp_dir = os.path.join(ext_dir, "_temp_extract")
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                
            with zipfile.ZipFile(vsix_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            # VS Code extensions have content in 'extension' folder
            inner_ext = os.path.join(temp_dir, "extension")
            pkg_path = os.path.join(inner_ext, "package.json") if os.path.exists(inner_ext) else os.path.join(temp_dir, "package.json")
            target_src = inner_ext if os.path.exists(inner_ext) else temp_dir
            
            if not os.path.exists(pkg_path):
                shutil.rmtree(temp_dir)
                return {"error": "Invalid VSIX: Missing package.json"}
                
            with open(pkg_path, 'r', encoding='utf-8') as f:
                pkg_data = json.load(f)
                
            ext_id = f"{pkg_data.get('publisher', 'unknown')}.{pkg_data.get('name', 'unknown')}"
            final_dir = os.path.join(ext_dir, ext_id)
            
            if os.path.exists(final_dir):
                shutil.rmtree(final_dir)
            
            shutil.move(target_src, final_dir)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                
            return {"success": True, "id": ext_id, "metadata": pkg_data}
        except Exception as e:
            return {"error": f"Failed to install extension: {str(e)}"}

    def list_extensions(self):
        import json
        try:
            ext_dir = os.path.join(os.path.expanduser("~"), ".hyperdrive", "extensions")
            if not os.path.exists(ext_dir):
                return []
            
            exts = []
            for d in os.listdir(ext_dir):
                d_path = os.path.join(ext_dir, d)
                if os.path.isdir(d_path):
                    pkg_path = os.path.join(d_path, "package.json")
                    if os.path.exists(pkg_path):
                        with open(pkg_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            # Get main script absolute path if it exists
                            main_script = data.get("main")
                            script_path = os.path.join(d_path, main_script) if main_script else None
                            exts.append({
                                "id": d,
                                "name": data.get("name", d),
                                "displayName": data.get("displayName", data.get("name", d)),
                                "description": data.get("description", ""),
                                "version": data.get("version", "1.0.0"),
                                "main": script_path
                            })
            return exts
        except Exception as e:
            return {"error": str(e)}

    def read_extension_script(self, script_path):
        try:
            if not os.path.exists(script_path):
                return {"error": "Script not found"}
            with open(script_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return {"error": str(e)}
