// src/lib/cpSatWorker.js
import { solveTimetableCpSat } from "./cpSatSolver";

self.onmessage = async (event) => {
  const { id, params } = event.data;
  try {
    const result = await solveTimetableCpSat(params);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({
      id,
      result: {
        ok: false,
        reason: "worker-error",
        message: err?.message || "CP-SAT worker failed",
      },
    });
  }
};