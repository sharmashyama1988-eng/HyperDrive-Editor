import os
import json
import subprocess
import urllib.request
import webview
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import traceback

class GitTool:

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

    def git_commit_push(self, repo_path, message):
        try:
            if not os.path.exists(repo_path):
                return {"error": "Workspace directory does not exist"}
            
            cflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            
            # 1. git add .
            add_res = subprocess.run(
                ["git", "add", "."],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=cflags
            )
            if add_res.returncode != 0:
                return {"error": f"Failed to git add: {add_res.stderr.strip()}"}

            # 2. git commit -m "message"
            commit_res = subprocess.run(
                ["git", "commit", "-m", message],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=cflags
            )
            # Ignore exit code 1 if it's just "nothing to commit"
            if commit_res.returncode != 0 and "nothing to commit" not in commit_res.stdout.lower():
                return {"error": f"Failed to git commit: {commit_res.stderr.strip() or commit_res.stdout.strip()}"}

            # 3. git push
            push_res = subprocess.run(
                ["git", "push"],
                cwd=repo_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=cflags
            )
            if push_res.returncode != 0:
                return {"error": f"Failed to git push: {push_res.stderr.strip()}"}

            return {"success": True, "message": "Successfully pushed to GitHub!"}
        except Exception as e:
            return {"error": str(e)}
