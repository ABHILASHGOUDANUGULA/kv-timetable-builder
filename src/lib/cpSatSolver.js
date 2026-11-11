// src/lib/cpSatSolver.js
//
// CP-SAT timetable solver using cpsat-js (OR-Tools CP-SAT → WASM).
// Returns the same result shape the greedy solver used to return, so
// the UI needs no changes beyond awaiting the call.
//
// Model summary (per section):
//   x[sec][sub][d][p]      = 1  →  subject placed in that slot
//   y[sec][os][d][p]       = 1  →  option-set occupies that slot
//   tv[sec][sub][tid][d][p]= 1  →  teacher teaches that slot
//
// Constraints:
//   1. ≤ 1 assignment per slot
//   2. weekly periods per subject exactly met
//   3. weekly periods per option set exactly met
//   4. teacher chosen iff subject placed  (sum tv == x or y)
//   5. no teacher teaches two classes in the same slot
//   6. max same subject per day
//   7. max teacher periods per day
//   8. fixed rules forced to 1
//   9. existing entries forced to 1 (empty mode) or fixed:true only (full mode)

import { CpModel, CpSolver, CpSolverStatus } from "cpsat-js";

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const safeArray = (v) => (Array.isArray(v) ? v : []);
const getSections = (c) =>
  safeArray(c?.sections).filter((s) => s.active !== false);

function sumExpr(model, vars) {
  if (vars.length === 0) return null;
  return vars.reduce((acc, v) => acc.plus(v), model.newConstant(0));
}

export async function solveTimetableCpSat(params) {
  const {
    classes = [],
    subjects = [],
    teachers = [],
    subjectMappings = [],
    teacherMappings = [],
    optionSets = [],
    periods = [],
    days = [],
    existingTimetable = [],
    fixedRules = [],
    config = {},
    mode = "empty",
  } = params || {};

  const { maxPerDay = 2, maxTeacherPeriodsPerDay = 6 } = config;

  // ─────────────────────────────── pre-flight ───────────────────────────────
  if (!periods.length || !classes.length || !subjects.length || !teachers.length) {
    return {
      ok: false,
      reason: "incomplete-setup",
      message: "Complete Bell Schedule, Classes, Subjects and Teachers first.",
    };
  }

  const allSections = [];
  classes.forEach((c) =>
    getSections(c).forEach((sec) =>
      allSections.push({
        classId: c.id,
        sectionId: sec.id,
        key: `${c.id}::${sec.id}`,
      })
    )
  );
  if (!allSections.length) {
    return {
      ok: false,
      reason: "no-sections",
      message:
        "No active class sections are available. Add/activate sections first.",
    };
  }

  // ─────────────────────────────── lookups ───────────────────────────────
  const subjectSet = new Set(subjects.map((s) => s.id));
  const teacherSet = new Set(teachers.map((t) => t.id));

  // subjectIds mapped to each class (section inherits from class)
  const validSubjects = new Map();
  allSections.forEach((sec) => {
    const set = new Set();
    subjectMappings.forEach((m) => {
      if (
        m.classId === sec.classId &&
        subjectSet.has(m.subjectId) &&
        Number(m.periodsPerWeek) > 0
      ) {
        set.add(m.subjectId);
      }
    });
    validSubjects.set(sec.key, set);
  });

  // periodsPerWeek[(secKey,sub)] and teachersFor[(secKey,sub)]
  const weeklyPeriods = new Map();
  const teachersFor = new Map();
  allSections.forEach((sec) => {
    validSubjects.get(sec.key).forEach((subId) => {
      const m = subjectMappings.find(
        (x) => x.classId === sec.classId && x.subjectId === subId
      );
      weeklyPeriods.set(`${sec.key}::${subId}`, Number(m?.periodsPerWeek) || 0);

      const tids = [
        ...new Set(
          teacherMappings
            .filter(
              (tm) =>
                tm.classId === sec.classId &&
                tm.sectionId === sec.sectionId &&
                tm.subjectId === subId &&
                teacherSet.has(tm.teacherId)
            )
            .map((tm) => tm.teacherId)
        ),
      ];
      teachersFor.set(`${sec.key}::${subId}`, tids);
    });
  });

  // Fail fast if a mapped subject has no teachers
  for (const [key, tids] of teachersFor) {
    const [secKey, subId] = key.split("::");
    if (tids.length === 0 && weeklyPeriods.get(key) > 0) {
      const sec = allSections.find((s) => s.key === secKey);
      const sub = subjects.find((s) => s.id === subId);
      return {
        ok: false,
        reason: "missing-teacher",
        message: `"${sub?.name || subId}" in ${sec?.classId || ""} has no teacher mapped. Map a teacher before generating.`,
      };
    }
  }

  // subjectInOptionSet[(secKey,sub)] = optionSetId | null
  const subjectInOptionSet = new Map();
  const optionSetsFor = new Map();
  allSections.forEach((sec) => {
    const sets = optionSets.filter(
      (os) => os.classId === sec.classId && os.active !== false
    );
    optionSetsFor.set(sec.key, sets);
    sets.forEach((os) =>
      os.subjectIds.forEach((subId) =>
        subjectInOptionSet.set(`${sec.key}::${subId}`, os.id)
      )
    );
  });

  let solverPromise = null;
async function getSolver() {
  if (!solverPromise) {
    solverPromise = CpSolver.create().catch((err) => {
      solverPromise = null; 
      throw err;
    });
  }
  return solverPromise;
}

  // ─────────────────────────────── solver load ───────────────────────────────
  let solver;
  try {
    solver = await getSolver();
  } catch (err) {
    return {
      ok: false,
      reason: "solver-load-failed",
      message:
        "Could not load the CP-SAT solver (WASM). Check your connection and retry.",
    };
  }

  // ─────────────────────────────── model ───────────────────────────────
  const model = new CpModel();

  const x = {}; // secKey::sub::d::p  → BoolVar  (non-option subjects)
  const y = {}; // secKey::os::d::p   → BoolVar  (option sets)
  const tv = {}; // secKey::sub::tid::d::p → BoolVar

  const xVars = [];
  const yVars = [];
  const tvVars = [];

  allSections.forEach((sec) => {
    const subs = validSubjects.get(sec.key);
    subs.forEach((subId) => {
      const inOption = subjectInOptionSet.get(`${sec.key}::${subId}`);
      const tids = teachersFor.get(`${sec.key}::${subId}`) || [];

      days.forEach((day, d) => {
        periods.forEach((period, p) => {
          if (!inOption) {
            const v = model.newBoolVar(`x_${sec.key}_${subId}_${d}_${p}`);
            x[`${sec.key}::${subId}::${d}::${p}`] = v;
            xVars.push({ sec, subId, d, p, v });
          }
          tids.forEach((tid) => {
            const v = model.newBoolVar(
              `t_${sec.key}_${subId}_${tid}_${d}_${p}`
            );
            tv[`${sec.key}::${subId}::${tid}::${d}::${p}`] = v;
            tvVars.push({ sec, subId, tid, d, p, v });
          });
        });
      });
    });

    // Option-set y vars
    (optionSetsFor.get(sec.key) || []).forEach((os) => {
      days.forEach((day, d) => {
        periods.forEach((period, p) => {
          const v = model.newBoolVar(`y_${sec.key}_${os.id}_${d}_${p}`);
          y[`${sec.key}::${os.id}::${d}::${p}`] = v;
          yVars.push({ sec, os, d, p, v });
        });
      });
    });
  });

  // ── Constraint 1: at most one assignment per slot ─────────────────────────
  allSections.forEach((sec) => {
    const subs = validSubjects.get(sec.key);
    const sets = optionSetsFor.get(sec.key) || [];
    days.forEach((day, d) =>
      periods.forEach((period, p) => {
        const vars = [];
        subs.forEach((subId) => {
          const v = x[`${sec.key}::${subId}::${d}::${p}`];
          if (v) vars.push(v);
        });
        sets.forEach((os) => {
          const v = y[`${sec.key}::${os.id}::${d}::${p}`];
          if (v) vars.push(v);
        });
        const sum = sumExpr(model, vars);
        if (sum && vars.length > 1) model.add(sum.le(1));
      })
    );
  });

  // ── Constraint 2: weekly periods per non-option subject ───────────────────
  allSections.forEach((sec) => {
    validSubjects.get(sec.key).forEach((subId) => {
      if (subjectInOptionSet.has(`${sec.key}::${subId}`)) return;
      const req = weeklyPeriods.get(`${sec.key}::${subId}`) || 0;
      if (req <= 0) return;
      const vars = [];
      days.forEach((day, d) =>
        periods.forEach((period, p) => {
          const v = x[`${sec.key}::${subId}::${d}::${p}`];
          if (v) vars.push(v);
        })
      );
      const sum = sumExpr(model, vars);
      if (sum) model.add(sum.equals(req));
    });
  });

  // ── Constraint 3: weekly periods per option set ───────────────────────────
  allSections.forEach((sec) => {
    (optionSetsFor.get(sec.key) || []).forEach((os) => {
      const req = Number(os.periodsPerWeek) || 0;
      if (req <= 0) return;
      const vars = [];
      days.forEach((day, d) =>
        periods.forEach((period, p) => {
          const v = y[`${sec.key}::${os.id}::${d}::${p}`];
          if (v) vars.push(v);
        })
      );
      const sum = sumExpr(model, vars);
      if (sum) model.add(sum.equals(req));
    });
  });

  // ── Constraint 4: teacher chosen iff subject placed ───────────────────────
  allSections.forEach((sec) => {
    validSubjects.get(sec.key).forEach((subId) => {
      const inOption = subjectInOptionSet.get(`${sec.key}::${subId}`);
      const tids = teachersFor.get(`${sec.key}::${subId}`) || [];
      if (!tids.length) return;
      days.forEach((day, d) =>
        periods.forEach((period, p) => {
          const target = inOption
            ? y[`${sec.key}::${inOption}::${d}::${p}`]
            : x[`${sec.key}::${subId}::${d}::${p}`];
          if (!target) return;
          const vars = tids
            .map((tid) => tv[`${sec.key}::${subId}::${tid}::${d}::${p}`])
            .filter(Boolean);
          const sum = sumExpr(model, vars);
          if (sum) model.add(sum.equals(target));
        })
      );
    });
  });

  // ── Constraint 5: no teacher teaches two classes in the same slot ─────────
  teachers.forEach((teacher) => {
    const tid = teacher.id;
    days.forEach((day, d) =>
      periods.forEach((period, p) => {
        const vars = tvVars
          .filter((v) => v.tid === tid && v.d === d && v.p === p)
          .map((v) => v.v);
        const sum = sumExpr(model, vars);
        if (sum && vars.length > 1) model.add(sum.le(1));
      })
    );
  });

  // ── Constraint 6: max same subject per day ────────────────────────────────
  if (maxPerDay > 0) {
    allSections.forEach((sec) => {
      validSubjects.get(sec.key).forEach((subId) => {
        const inOption = subjectInOptionSet.get(`${sec.key}::${subId}`);
        if (inOption) return; // option-set limit comes from y weekly count
        days.forEach((day, d) => {
          const vars = [];
          periods.forEach((period, p) => {
            const v = x[`${sec.key}::${subId}::${d}::${p}`];
            if (v) vars.push(v);
          });
          const sum = sumExpr(model, vars);
          if (sum && vars.length > 1) model.add(sum.le(maxPerDay));
        });
      });
    });
  }

  // ── Constraint 7: max teacher periods per day ─────────────────────────────
  if (maxTeacherPeriodsPerDay > 0) {
    teachers.forEach((teacher) => {
      const tid = teacher.id;
      days.forEach((day, d) => {
        const vars = tvVars
          .filter((v) => v.tid === tid && v.d === d)
          .map((v) => v.v);
        const sum = sumExpr(model, vars);
        if (sum && vars.length > 1) model.add(sum.le(maxTeacherPeriodsPerDay));
      });
    });
  }

  // ── Constraint 8: fixed rules forced to 1 ─────────────────────────────────
  function findVar(sec, subId, d, p) {
    const inOption = subjectInOptionSet.get(`${sec.key}::${subId}`);
    return inOption
      ? y[`${sec.key}::${inOption}::${d}::${p}`]
      : x[`${sec.key}::${subId}::${d}::${p}`];
  }

  fixedRules.forEach((rule) => {
    const sec = allSections.find(
      (s) => s.classId === rule.classId && s.sectionId === rule.sectionId
    );
    if (!sec) return;
    const d = days.indexOf(rule.day);
    const p = periods.findIndex((period) => period.id === rule.periodId);
    if (d === -1 || p === -1) return;
    const v = findVar(sec, rule.subjectId, d, p);
    if (v) model.add(v.equals(1));
  });

  // ── Constraint 9: preserve existing entries ───────────────────────────────
  const preserveEntries =
    mode === "empty"
      ? existingTimetable
      : existingTimetable.filter((e) => e.fixed === true);

  preserveEntries.forEach((e) => {
    const sec = allSections.find(
      (s) => s.classId === e.classId && s.sectionId === e.sectionId
    );
    if (!sec) return;
    const d = days.indexOf(e.day);
    const p = periods.findIndex((period) => period.id === e.periodId);
    if (d === -1 || p === -1) return;
    const v = findVar(sec, e.subjectId, d, p);
    if (v) model.add(v.equals(1));
    // Pin the teacher too, so CP-SAT doesn't silently reassign
    if (e.teacherId) {
      const tvv = tv[`${sec.key}::${e.subjectId}::${e.teacherId}::${d}::${p}`];
      if (tvv) model.add(tvv.equals(1));
    }
  });

  // ─────────────────────────────── solve ───────────────────────────────
  let result;
  try {
    result = solver.solve(model, { maxTimeInSeconds: 60, numWorkers: 1 });
  } catch (err) {
    return {
      ok: false,
      reason: "solver-error",
      message: `CP-SAT solve failed: ${err?.message || "unknown error"}`,
    };
  }

  if (
    result.status === CpSolverStatus.INFEASIBLE ||
    result.status === CpSolverStatus.MODEL_INVALID
  ) {
    return {
      ok: false,
      reason: "infeasible",
      message:
        "No valid timetable exists with these constraints. Check teacher mappings, weekly periods, max-per-day limits and fixed rules.",
    };
  }
  if (
    result.status === CpSolverStatus.UNKNOWN ||
    (result.status !== CpSolverStatus.OPTIMAL &&
      result.status !== CpSolverStatus.FEASIBLE)
  ) {
    return {
      ok: false,
      reason: "timeout",
      message:
        "CP-SAT could not find a complete timetable within 60 seconds. Reduce constraints or try again.",
    };
  }

  // ─────────────────────────────── extract ───────────────────────────────
  const timetable = [];

  xVars.forEach(({ sec, subId, d, p, v }) => {
    if (result.value(v) !== 1) return;
    const tids = teachersFor.get(`${sec.key}::${subId}`) || [];
    let chosen = "";
    for (const tid of tids) {
      const tvv = tv[`${sec.key}::${subId}::${tid}::${d}::${p}`];
      if (tvv && result.value(tvv) === 1) {
        chosen = tid;
        break;
      }
    }
    timetable.push({
      id: makeId(),
      day: days[d],
      classId: sec.classId,
      sectionId: sec.sectionId,
      periodId: periods[p].id,
      subjectId: subId,
      teacherId: chosen || tids[0] || "",
      updatedAt: new Date().toISOString(),
    });
  });

  yVars.forEach(({ sec, os, d, p, v }) => {
    if (result.value(v) !== 1) return;
    os.subjectIds.forEach((subId) => {
      if (!subjectSet.has(subId)) return;
      const tids = teachersFor.get(`${sec.key}::${subId}`) || [];
      let chosen = "";
      for (const tid of tids) {
        const tvv = tv[`${sec.key}::${subId}::${tid}::${d}::${p}`];
        if (tvv && result.value(tvv) === 1) {
          chosen = tid;
          break;
        }
      }
      timetable.push({
        id: makeId(),
        day: days[d],
        classId: sec.classId,
        sectionId: sec.sectionId,
        periodId: periods[p].id,
        subjectId: subId,
        teacherId: chosen || tids[0] || "",
        parallelGroup: os.id,
        updatedAt: new Date().toISOString(),
      });
    });
  });

  // ─────────────────────────────── unplaced report ───────────────────────────────
  const placed = new Map();
  timetable.forEach((e) => {
    const k = `${e.classId}::${e.sectionId}::${e.subjectId}`;
    placed.set(k, (placed.get(k) || 0) + 1);
  });
  const unplacedGroups = [];
  allSections.forEach((sec) => {
    validSubjects.get(sec.key).forEach((subId) => {
      const req = weeklyPeriods.get(`${sec.key}::${subId}`) || 0;
      const got = placed.get(`${sec.classId}::${sec.sectionId}::${subId}`) || 0;
      if (got < req) {
        unplacedGroups.push({
          classId: sec.classId,
          sectionId: sec.sectionId,
          subjectId: subId,
          remaining: req - got,
        });
      }
    });
  });

  return {
    ok: true,
    timetable,
    newEntriesCount: timetable.length,
    fixedCount: fixedRules.length,
    unplacedCount: unplacedGroups.length,
    unplacedGroups,
    mode,
  };
}