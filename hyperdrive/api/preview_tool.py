import os
import json
import subprocess
import urllib.request
import webview
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import traceback

class PreviewTool:

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
