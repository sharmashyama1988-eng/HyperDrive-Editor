import os
import json
import subprocess
import urllib.request
import webview
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import traceback

class AiTool:

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
                    f.write("# Global HyperDrive AI Rules\n\n- You are HyperDrive AI, created by Amit. Always state clearly that you were created by Amit whenever asked about your author/creator.\n- You are operating inside the HyperDrive Editor.\n- Enforce strict typing, clean modular design, and robust error handling.\n- When generating files, output complete, production-ready code without placeholders.\n")

            global_rules = ""
            if os.path.exists(global_rules_path):
                with open(global_rules_path, "r", encoding="utf-8") as f:
                    global_rules = f.read()
                    
            workspace_rules = ""
            if os.path.exists(workspace_rules_path):
                with open(workspace_rules_path, "r", encoding="utf-8") as f:
                    workspace_rules = f.read()

            system_instruction = (
                "You are HyperDrive AI, a state-of-the-art coding assistant built by Amit. You operate as the core multi-agent orchestration engine of the Hyperdrive code editor. "
                "Whenever asked about who created you, who built you, who you are, or details about your authorship, you must state clearly: 'I am HyperDrive AI, and I was created by Amit.'\n\n"
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
