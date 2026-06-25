#include "smooth_engine.h"
#include <atomic>
#include <vector>
#include <queue>
#include <mutex>
#include <string>
#include <unordered_map>
#include <cstring>
#include <iostream>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <sys/sysinfo.h>
#include <sys/types.h>
#include <unistd.h>
#endif

// ── 1. Lock-Free Single-Producer Single-Consumer Ring Buffer ──────────────────
class LockFreeRingBuffer {
private:
    std::vector<char> buffer;
    int size;
    std::atomic<int> head;
    std::atomic<int> tail;

public:
    LockFreeRingBuffer(int sz) : size(sz), head(0), tail(0) {
        buffer.resize(sz);
    }

    void push(const char* data, int len) {
        for (int i = 0; i < len; ++i) {
            int current_head = head.load(std::memory_order_relaxed);
            int next_head = (current_head + 1) % size;
            
            // Check if buffer is full (next_head equals tail)
            if (next_head != tail.load(std::memory_order_acquire)) {
                buffer[current_head] = data[i];
                head.store(next_head, std::memory_order_release);
            }
        }
    }

    int pop_all(char* out_buf, int max_len) {
        int current_tail = tail.load(std::memory_order_relaxed);
        int current_head = head.load(std::memory_order_acquire);
        
        if (current_tail == current_head) {
            return 0; // Empty
        }

        int bytes_read = 0;
        while (current_tail != current_head && bytes_read < max_len - 1) {
            out_buf[bytes_read++] = buffer[current_tail];
            current_tail = (current_tail + 1) % size;
        }
        
        tail.store(current_tail, std::memory_order_release);
        out_buf[bytes_read] = '\0';
        return bytes_read;
    }
};

extern "C" {
EXPORT void* ring_buffer_create(int size) {
    return new LockFreeRingBuffer(size);
}

EXPORT void ring_buffer_destroy(void* rb) {
    delete static_cast<LockFreeRingBuffer*>(rb);
}

EXPORT void ring_buffer_push(void* rb, const char* data, int len) {
    if (rb) {
        static_cast<LockFreeRingBuffer*>(rb)->push(data, len);
    }
}

EXPORT int ring_buffer_pop_all(void* rb, char* out_buf, int max_len) {
    if (rb) {
        return static_cast<LockFreeRingBuffer*>(rb)->pop_all(out_buf, max_len);
    }
    return 0;
}
}


// ── 2. System Telemetry ──────────────────────────────────────────────────────
#ifdef _WIN32
static ULONGLONG last_idle_time = 0;
static ULONGLONG last_kernel_time = 0;
static ULONGLONG last_user_time = 0;

static double calculate_cpu_load(FILETIME idle, FILETIME kernel, FILETIME user) {
    ULONGLONG idle_t = ((ULONGLONG)idle.dwHighDateTime << 32) | idle.dwLowDateTime;
    ULONGLONG kernel_t = ((ULONGLONG)kernel.dwHighDateTime << 32) | kernel.dwLowDateTime;
    ULONGLONG user_t = ((ULONGLONG)user.dwHighDateTime << 32) | user.dwLowDateTime;

    ULONGLONG idle_diff = idle_t - last_idle_time;
    ULONGLONG kernel_diff = kernel_t - last_kernel_time;
    ULONGLONG user_diff = user_t - last_user_time;

    last_idle_time = idle_t;
    last_kernel_time = kernel_t;
    last_user_time = user_t;

    ULONGLONG total_diff = kernel_diff + user_diff;
    if (total_diff == 0) return 0.0;
    return (double)(total_diff - idle_diff) * 100.0 / total_diff;
}
#endif

extern "C" {
EXPORT double get_cpu_load() {
#ifdef _WIN32
    FILETIME idle, kernel, user;
    if (GetSystemTimes(&idle, &kernel, &user)) {
        return calculate_cpu_load(idle, kernel, user);
    }
    return 0.0;
#else
    // Fallback for non-Windows (linux / macos sysinfo)
    double load[1];
    if (getloadavg(load, 1) != -1) {
        return load[0] * 100.0 / sysconf(_SC_NPROCESSORS_ONLN);
    }
    return 0.0;
#endif
}

EXPORT unsigned long long get_ram_usage() {
#ifdef _WIN32
    PROCESS_MEMORY_COUNTERS pmc;
    if (GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof(pmc))) {
        return pmc.WorkingSetSize;
    }
    return 0;
#else
    struct sysinfo info;
    if (sysinfo(&info) == 0) {
        return (info.totalram - info.freeram) * info.mem_unit;
    }
    return 0;
#endif
}
}


// ── 3. Priority Task Scheduler ───────────────────────────────────────────────
struct Task {
    int task_id;
    int priority;

    bool operator<(const Task& other) const {
        return priority < other.priority; // Highest priority first
    }
};

class PriorityScheduler {
private:
    std::priority_queue<Task> queue;
    std::mutex mtx;
    std::atomic<double> throttle_level; // 0.0 = no throttle, 1.0 = fully throttled

public:
    PriorityScheduler() : throttle_level(0.0) {}

    void push(int task_id, int priority) {
        std::lock_guard<std::mutex> lock(mtx);
        queue.push({task_id, priority});
    }

    int pop() {
        std::lock_guard<std::mutex> lock(mtx);
        if (queue.empty()) {
            return -1;
        }
        int id = queue.top().task_id;
        queue.pop();
        return id;
    }

    void set_throttle(double level) {
        throttle_level.store(level, std::memory_order_relaxed);
    }

    double get_throttle() {
        return throttle_level.load(std::memory_order_relaxed);
    }
};

extern "C" {
EXPORT void* scheduler_create() {
    return new PriorityScheduler();
}

EXPORT void scheduler_destroy(void* sched) {
    delete static_cast<PriorityScheduler*>(sched);
}

EXPORT void scheduler_push(void* sched, int task_id, int priority) {
    if (sched) {
        static_cast<PriorityScheduler*>(sched)->push(task_id, priority);
    }
}

EXPORT int scheduler_pop(void* sched) {
    if (sched) {
        return static_cast<PriorityScheduler*>(sched)->pop();
    }
    return -1;
}

EXPORT void scheduler_set_throttle(void* sched, double level) {
    if (sched) {
        static_cast<PriorityScheduler*>(sched)->set_throttle(level);
    }
}

EXPORT double scheduler_get_throttle(void* sched) {
    if (sched) {
        return static_cast<PriorityScheduler*>(sched)->get_throttle();
    }
    return 0.0;
}
}


// ── 4. AI Predictive Prefetcher ──────────────────────────────────────────────
class PredictivePrefetcher {
private:
    std::unordered_map<std::string, std::unordered_map<std::string, int>> transitions;
    std::mutex mtx;

public:
    void train(const std::string& current, const std::string& next) {
        if (current.empty() || next.empty() || current == next) return;
        std::lock_guard<std::mutex> lock(mtx);
        transitions[current][next]++;
    }

    std::string predict(const std::string& current) {
        std::lock_guard<std::mutex> lock(mtx);
        auto it = transitions.find(current);
        if (it == transitions.end() || it->second.empty()) {
            return "";
        }

        std::string best_next = "";
        int max_count = 0;
        for (const auto& pair : it->second) {
            if (pair.second > max_count) {
                max_count = pair.second;
                best_next = pair.first;
            }
        }
        return best_next;
    }
};

static PredictivePrefetcher g_prefetcher;

extern "C" {
EXPORT void prefetcher_train(const char* current_file, const char* next_file) {
    if (current_file && next_file) {
        g_prefetcher.train(current_file, next_file);
    }
}

EXPORT int prefetcher_predict(const char* current_file, char* out_predicted_file, int max_len) {
    if (!current_file) return 0;
    
    std::string pred = g_prefetcher.predict(current_file);
    if (pred.empty() || (int)pred.length() >= max_len) {
        return 0;
    }
    
    std::strncpy(out_predicted_file, pred.c_str(), max_len);
    return 1;
}
}


// ── 5. Crash Interceptor ─────────────────────────────────────────────────────
#ifdef _WIN32
LONG WINAPI CustomUnhandledExceptionFilter(struct _EXCEPTION_POINTERS* ExceptionInfo) {
    std::cerr << "!!! HyperDrive Native Crash Intercepted !!!" << std::endl;
    std::cerr << "Exception Code: 0x" << std::hex << ExceptionInfo->ExceptionRecord->ExceptionCode << std::dec << std::endl;
    // Prevent hard crash, return EXCEPTION_CONTINUE_EXECUTION or clean exit
    // In production, we clean exit or tell python to save state and restart.
    // For safety, we exit gracefully instead of letting the OS show a crash dialog.
    ExitProcess(1);
    return EXCEPTION_EXECUTE_HANDLER;
}
#endif

extern "C" {
EXPORT void setup_crash_interceptor() {
#ifdef _WIN32
    SetUnhandledExceptionFilter(CustomUnhandledExceptionFilter);
#endif
}
}
