#ifndef SMOOTH_ENGINE_H
#define SMOOTH_ENGINE_H

#ifdef _WIN32
#define EXPORT __declspec(dllexport)
#else
#define EXPORT __attribute__((visibility("default")))
#endif

extern "C" {

// ── Ring Buffer API ────────────────────────────────────────────────────────
EXPORT void* ring_buffer_create(int size);
EXPORT void ring_buffer_destroy(void* rb);
EXPORT void ring_buffer_push(void* rb, const char* data, int len);
EXPORT int ring_buffer_pop_all(void* rb, char* out_buf, int max_len);

// ── Telemetry Monitor API ──────────────────────────────────────────────────
EXPORT double get_cpu_load();
EXPORT unsigned long long get_ram_usage();

// ── Priority Scheduler API ──────────────────────────────────────────────────
EXPORT void* scheduler_create();
EXPORT void scheduler_destroy(void* sched);
EXPORT void scheduler_push(void* sched, int task_id, int priority);
EXPORT int scheduler_pop(void* sched);
EXPORT void scheduler_set_throttle(void* sched, double level);
EXPORT double scheduler_get_throttle(void* sched);

// ── Predictive Prefetcher API ────────────────────────────────────────────────
EXPORT void prefetcher_train(const char* current_file, const char* next_file);
EXPORT int prefetcher_predict(const char* current_file, char* out_predicted_file, int max_len);

// ── Crash Interceptor Hook ──────────────────────────────────────────────────
EXPORT void setup_crash_interceptor();

}

#endif // SMOOTH_ENGINE_H
