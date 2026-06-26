import os
import sys
import subprocess

def find_compiler():
    # 1. Check if clang++ is in PATH
    try:
        res = subprocess.run(["clang++", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            print("Found clang++ in PATH")
            return "clang++"
    except Exception:
        pass

    # 2. Check if g++ is in PATH
    try:
        res = subprocess.run(["g++", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            print("Found g++ in PATH")
            return "g++"
    except Exception:
        pass

    # 3. Check standard LLVM and Mingw/msys2/w64devkit installation paths (Windows)
    compiler_paths = [
        r"d:\trinity engine\native\compiler\w64devkit\bin\g++.exe",
        r"D:\msys64\mingw64\bin\g++.exe",
        r"D:\msys64\ucrt64\bin\g++.exe",
        r"C:\msys64\mingw64\bin\g++.exe",
        r"C:\msys64\ucrt64\bin\g++.exe",
        r"C:\MinGW\bin\g++.exe",
        r"C:\Program Files\LLVM\bin\clang++.exe",
        r"C:\Program Files (x86)\LLVM\bin\clang++.exe"
    ]
    for lp in compiler_paths:
        if os.path.exists(lp):
            print(f"Found compiler at: {lp}")
            return lp

    # 4. Check MSVC cl.exe using vswhere
    try:
        vswhere_path = r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
        if os.path.exists(vswhere_path):
            output = subprocess.check_output([
                vswhere_path, "-latest", "-products", "*", 
                "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", 
                "-property", "installationPath"
            ], text=True).strip()
            if output:
                # Find cl.exe inside installationPath
                vc_dir = os.path.join(output, "VC", "Tools", "MSVC")
                if os.path.exists(vc_dir):
                    versions = os.listdir(vc_dir)
                    if versions:
                        versions.sort()
                        latest_ver = versions[-1]
                        cl_path = os.path.join(vc_dir, latest_ver, "bin", "Hostx64", "x64", "cl.exe")
                        if os.path.exists(cl_path):
                            print(f"Found MSVC cl.exe at: {cl_path}")
                            return ("cl.exe", cl_path, os.path.join(output, "Common7", "Tools", "VsDevCmd.bat"))
    except Exception as e:
        print("MSVC search failed:", e)

    return None

def build():
    compiler_info = find_compiler()
    if not compiler_info:
        print("ERROR: No suitable C++ compiler (clang++, g++, cl.exe) was found.")
        print("Dynamic compilation skipped. Smooth Engine will load Python fallback.")
        return False

    cpp_file = os.path.join("src-cpp", "smooth_engine.cpp")
    dll_file = "smooth_engine.dll"

    print(f"Compiling {cpp_file} -> {dll_file}...")

    if isinstance(compiler_info, tuple) and compiler_info[0] == "cl.exe":
        _, cl_path, vsdevcmd = compiler_info
        # MSVC compile requires environment variables setup
        cmd = f'"{vsdevcmd}" && cl.exe /LD /O2 /EHsc "{cpp_file}" /link /out:"{dll_file}" psapi.lib'
        print("Running MSVC command:", cmd)
        res = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    else:
        # Clang or GCC
        compiler_path = compiler_info
        bin_dir = os.path.dirname(compiler_path)
        if bin_dir:
            os.environ["PATH"] = bin_dir + os.path.pathsep + os.environ.get("PATH", "")
        cmd = [compiler_path, "-O3", "-shared", "-o", dll_file, cpp_file, "-lpsapi"]
        print("Running command:", " ".join(cmd))
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if res.returncode == 0:
        print("SUCCESS: smooth_engine.dll compiled successfully!")
        # Clean up temporary MSVC files
        for ext in [".obj", ".lib", ".exp"]:
            temp_file = "smooth_engine" + ext
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass
        return True
    else:
        print("ERROR: Compilation failed!")
        print("Stdout:", res.stdout)
        print("Stderr:", res.stderr)
        return False

if __name__ == "__main__":
    success = build()
    sys.exit(0 if success else 1)
