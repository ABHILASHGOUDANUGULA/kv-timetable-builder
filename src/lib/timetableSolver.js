// src/lib/timetableSolver.js
//
// Worker bridge for the CP-SAT solver.
// Vite bundles the worker natively via `new Worker(new URL(...), {
// type: 'module' })`, so no extra plugin is needed.
//
// The solver always resolves with a result object (never rejects),
// so callers can safely `await` without a try/catch.

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./cpSatWorker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event) => {
      const { id, result } = event.data;
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve(result);
      }
    };
    worker.onerror = (err) => {
      for (const resolve of pending.values()) {
        resolve({
          ok: false,
          reason: "worker-error",
          message: err.message || "CP-SAT worker crashed",
        });
      }
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

/**
 * Async entry point. Same params and same result shape as the old
 * sync `solveTimetable`. Backed by CP-SAT running in a Web Worker.
 */
export function solveTimetableAsync(params) {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ id, params });
  });
}