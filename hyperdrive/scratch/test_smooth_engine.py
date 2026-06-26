import os
import sys
import ctypes

# Add root folder to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app import SmoothEngine, SmoothRingBuffer, get_system_cpu_load, get_process_ram_usage, SmoothSchedulerWrapper, SmoothPrefetcherWrapper
    print("SUCCESS: Successfully imported SmoothEngine wrappers from app.py!")
except Exception as e:
    print("FAILED: Import failed from app.py:", e)
    sys.exit(1)

def test_all():
    print("\n--- Running SmoothEngine C++ DLL & Fallback Tests ---")
    
    # 1. Check DLL Loading
    dll = SmoothEngine.load()
    if dll:
        print("Test 1: C++ DLL loaded successfully!")
    else:
        print("Test 1: WARNING - C++ DLL failed to load, testing Python fallbacks.")
        
    # 2. Test Ring Buffer
    rb = SmoothRingBuffer(size=1024)
    print("Test 2: Created SmoothRingBuffer.")
    test_str = "Hello, this is a test of the smooth ring buffer!"
    rb.push(test_str)
    popped = rb.pop_all()
    if popped == test_str:
        print(f"Test 2 PASS: RingBuffer push/pop match: '{popped}'")
    else:
        print(f"Test 2 FAIL: RingBuffer push/pop mismatch! Got '{popped}', expected '{test_str}'")

    # 3. Test Telemetry
    cpu = get_system_cpu_load()
    ram = get_process_ram_usage()
    print(f"Test 3 PASS: Telemetry: CPU Load = {cpu:.2f}%, RAM Usage = {ram / (1024*1024):.2f} MB")

    # 4. Test Scheduler
    sched = SmoothSchedulerWrapper()
    print("Test 4: Created SmoothScheduler.")
    sched.push(101, 10)  # High priority task
    sched.push(102, 1)   # Low priority task
    sched.push(103, 5)   # Medium priority task
    
    p1 = sched.pop()
    p2 = sched.pop()
    p3 = sched.pop()
    if p1 == 101 and p2 == 103 and p3 == 102:
        print("Test 4 PASS: Scheduler priorities pop correctly (101 -> 103 -> 102).")
    else:
        print(f"Test 4 FAIL: Scheduler pop order incorrect! Got: {p1}, {p2}, {p3}")

    # 5. Test Prefetcher
    pref = SmoothPrefetcherWrapper()
    print("Test 5: Created SmoothPrefetcher.")
    pref.train("src/main.ts", "src/styles.css")
    pref.train("src/main.ts", "src/styles.css")
    pref.train("src/main.ts", "src/utils.ts")
    
    pred = pref.predict("src/main.ts")
    if pred == "src/styles.css":
        print(f"Test 5 PASS: Prefetcher prediction correct: '{pred}'")
    else:
        print(f"Test 5 FAIL: Prefetcher prediction incorrect! Got '{pred}'")

if __name__ == "__main__":
    test_all()
