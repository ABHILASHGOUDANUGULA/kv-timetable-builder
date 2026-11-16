
 // src/lib/timetableSolver.js

let worker = null;
let nextId = 1;

const pending = new Map();

// CP-SAT currently has a 60-second solve limit.
// Allow a little extra time for worker communication.
const REQUEST_TIMEOUT_MS = 70_000;

function clearPendingRequest(id) {
  const request = pending.get(id);

  if (request) {
    clearTimeout(request.timer);
    pending.delete(id);
  }

  return request;
}

function getWorker() {
  if (!worker) {
    worker = new Worker(
      new URL("./cpSatWorker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event) => {
      const { id, result } = event.data || {};
      const request = clearPendingRequest(id);

      if (request) {
        request.resolve(
          result || {
            ok: false,
            reason: "worker-error",
            message: "Worker returned an empty result.",
          }
        );
      }
    };

    worker.onerror = (err) => {
      const errorMessage =
        err.message || "CP-SAT worker crashed.";

      for (const [id] of pending) {
        const request = clearPendingRequest(id);

        if (request) {
          request.resolve({
            ok: false,
            reason: "worker-error",
            message: errorMessage,
          });
        }
      }

      worker?.terminate();
      worker = null;
    };
  }

  return worker;
}

export function solveTimetableAsync(params) {
  return new Promise((resolve) => {
    const id = nextId++;

    let w;

    try {
      w = getWorker();
    } catch (err) {
      resolve({
        ok: false,
        reason: "worker-error",
        message: err?.message || "Unable to start CP-SAT worker.",
      });
      return;
    }

    const timer = setTimeout(() => {
  // The Worker may still be busy solving. Terminate it so the next
  // generation request can start with a clean Worker.
  const oldWorker = worker;
  worker = null;

  oldWorker?.terminate();

  // Resolve every pending request because all were sent to this Worker.
  for (const [pendingId] of pending) {
    const request = clearPendingRequest(pendingId);

    if (request) {
      request.resolve({
        ok: false,
        reason: "worker-timeout",
        message:
          "The timetable solver timed out. The worker was restarted. Please try generating again.",
      });
    }
  }
}, REQUEST_TIMEOUT_MS);

    pending.set(id, { resolve, timer });

    try {
      w.postMessage({ id, params });
    } catch (err) {
      const request = clearPendingRequest(id);

      if (request) {
        request.resolve({
          ok: false,
          reason: "worker-error",
          message:
            err?.message || "Failed to send request to solver worker.",
        });
      }
    }
  });
}
