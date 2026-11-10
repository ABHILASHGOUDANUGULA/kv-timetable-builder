// src/lib/timetableSolver.js
//
// Pure timetable solver.
//
// Given the school's configuration and existing state, produce a full
// timetable array. No React, no side effects, no arguments mutated.
//
// The algorithm is the same greedy heuristic the component used before
// extraction. Later phases will add:
//   - lab double-periods
//   - language blocks
//   - teacher daily-load caps
//   - a better search engine (simulated annealing / CP-SAT)
// The signature below is designed to stay stable across those changes.

const safeArray = (v) => (Array.isArray(v) ? v : []);
const getSections = (c) =>
  safeArray(c?.sections).filter((s) => s.active !== false);
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * @param {object} params
 * @param {Array}  params.classes           Active classes (each with .sections)
 * @param {Array}  params.subjects          Active subjects
 * @param {Array}  params.teachers          Active teachers
 * @param {Array}  params.subjectMappings   { classId, subjectId, periodsPerWeek }
 * @param {Array}  params.teacherMappings   { classId, sectionId, subjectId, teacherId }
 * @param {Array}  params.periods           Period-type schedule items only (no breaks)
 * @param {Array}  params.days              ["Monday", ...]
 * @param {Array}  params.existingTimetable Current timetable entries (used in "empty" mode)
 * @param {Array}  params.substitutions     Current substitution records
 * @param {Array}  params.fixedRules        Pinned slot rules
 * @param {object} params.config            { maxPerDay, avoidConsecutive, balanceWorkload }
 * @param {string} params.mode              "empty" (fill gaps) | "full" (regenerate all)
 *
 * @returns {object}
 *   On failure: { ok: false, reason, message }
 *   On success: { ok: true, timetable, newEntriesCount, fixedCount, unplacedCount, unplacedGroups, mode }
 */
export function solveTimetable(params) {
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
    substitutions = [],
    fixedRules = [],
    config = {},
    mode = "empty",
  } = params || {};

    const {
    maxPerDay = 2,
    avoidConsecutive = true,
    balanceWorkload = true,
    maxTeacherPeriodsPerDay = 6,
  } = config;

  // ---------------------------------------------------------------
  // Pre-flight checks
  // ---------------------------------------------------------------
  if (!periods.length || !classes.length || !subjects.length || !teachers.length) {
    return {
      ok: false,
      reason: "incomplete-setup",
      message:
        "Complete Bell Schedule, Classes, Subjects and Teachers first.",
    };
  }

  const activeSectionCount = classes.reduce(
    (sum, c) => sum + getSections(c).length,
    0
  );
  if (!activeSectionCount) {
    return {
      ok: false,
      reason: "no-sections",
      message:
        "No active class sections are available. Add/activate sections first.",
    };
  }

  const slotCapacity = activeSectionCount * periods.length * days.length;
  const weeklyDemand = classes.reduce((sum, c) => {
    const sectionCount = getSections(c).length;
    return (
      sum +
      sectionCount *
        subjectMappings
          .filter(
            (m) =>
              m.classId === c.id &&
              subjects.some((s) => s.id === m.subjectId)
          )
          .reduce((n, m) => n + Math.max(0, Number(m.periodsPerWeek) || 0), 0)
    );
  }, 0);

  if (weeklyDemand > slotCapacity && mode === "full") {
    return {
      ok: false,
      reason: "over-capacity",
      message: `Weekly subject demand (${weeklyDemand}) exceeds available class slots (${slotCapacity}). Reduce periods/week or add periods/days.`,
    };
  }

  // ---------------------------------------------------------------
  // Substitution awareness — a slot's "effective" teacher is the
  // substitute when one is assigned.
  // ---------------------------------------------------------------
  const substitutionMap = new Map();
  substitutions.forEach((s) => substitutionMap.set(s.timetableEntryId, s));
  const effectiveTeacherId = (entry) =>
    substitutionMap.get(entry.id)?.substituteTeacherId || entry.teacherId;

  // ---------------------------------------------------------------
  // Base timetable + tracking
  // ---------------------------------------------------------------
  // Preserve manually-locked entries (fixed: true) in BOTH modes so the
// user's manual edits always survive regeneration. In "empty" mode we
// also keep every existing entry, matching the "fill the gaps" behaviour.
const base =
  mode === "empty"
    ? [...existingTimetable]
    : existingTimetable.filter((e) => e.fixed === true);

    const busyTeachers = new Set();
  const subjectDayCounts = new Map();
  const teacherDayCounts = new Map();

  const trackEntry = (e) => {
    const occupiedTeacherId = effectiveTeacherId(e);
    if (occupiedTeacherId) {
      busyTeachers.add(`${e.day}::${e.periodId}::${occupiedTeacherId}`);
      const tdKey = `${e.day}::${occupiedTeacherId}`;
      teacherDayCounts.set(tdKey, (teacherDayCounts.get(tdKey) || 0) + 1);
    }
    const sdKey = `${e.classId}::${e.sectionId}::${e.subjectId}::${e.day}`;
    subjectDayCounts.set(sdKey, (subjectDayCounts.get(sdKey) || 0) + 1);
  };
  base.forEach(trackEntry);

  // ---------------------------------------------------------------
  // Fixed rules (placed before free fill)
  // ---------------------------------------------------------------
  const fixedPlacements = [];

  fixedRules.forEach((rule) => {
    const alreadyOccupied = [...base, ...fixedPlacements].some(
      (e) =>
        e.day === rule.day &&
        e.classId === rule.classId &&
        e.sectionId === rule.sectionId &&
        e.periodId === rule.periodId
    );
    if (alreadyOccupied) return;

    const subjectMapping = subjectMappings.find(
      (m) =>
        m.classId === rule.classId &&
        m.subjectId === rule.subjectId &&
        Number(m.periodsPerWeek) > 0
    );
    const ruleClass = classes.find((c) => c.id === rule.classId);
    if (
      !subjectMapping ||
      !getSections(ruleClass).some((s) => s.id === rule.sectionId) ||
      !days.includes(rule.day) ||
      !periods.some((p) => p.id === rule.periodId)
    ) {
      return;
    }

    const subjectPlacedCount = [...base, ...fixedPlacements].filter(
      (e) =>
        e.classId === rule.classId &&
        e.sectionId === rule.sectionId &&
        e.subjectId === rule.subjectId
    ).length;
    if (subjectPlacedCount >= Number(subjectMapping.periodsPerWeek)) return;

    const teacherIds = [
      ...new Set(
        teacherMappings
          .filter(
            (m) =>
              m.classId === rule.classId &&
              m.sectionId === rule.sectionId &&
              m.subjectId === rule.subjectId
          )
          .map((m) => m.teacherId)
      ),
    ].filter((id) => teachers.some((t) => t.id === id));
    if (!teacherIds.length) return;

    let chosen = "";
    for (const tid of teacherIds) {
      if (!busyTeachers.has(`${rule.day}::${rule.periodId}::${tid}`)) {
        chosen = tid;
        break;
      }
    }

    const entry = {
      id: makeId(),
      day: rule.day,
      classId: rule.classId,
      sectionId: rule.sectionId,
      periodId: rule.periodId,
      subjectId: rule.subjectId,
      teacherId: chosen,
      fixed: true,
      updatedAt: new Date().toISOString(),
    };
    fixedPlacements.push(entry);
    trackEntry(entry);
  });

  const baseWithFixed = [...base, ...fixedPlacements];

  // ---------------------------------------------------------------
  // Requirements — every (class, section, subject) still short of
  // its weekly target becomes a requirement.
  // ---------------------------------------------------------------
  const requirements = [];

    const subjectsInOptionSets = new Set();
  optionSets.forEach((set) => {
    if (set.active === false) return;
    (set.subjectIds || []).forEach((subId) => {
      subjectsInOptionSets.add(`${set.classId}::${subId}`);
    });
  });

  classes.forEach((c) => {
    getSections(c).forEach((sec) => {
      subjectMappings
        .filter((m) => m.classId === c.id && Number(m.periodsPerWeek) > 0)
        .forEach((m) => {
          if (!subjects.some((s) => s.id === m.subjectId)) return;

          // Skip subjects that belong to an option set — they are placed
          // together by the option-set scheduler below.
          if (subjectsInOptionSets.has(`${c.id}::${m.subjectId}`)) return;

          const alreadyPlaced = baseWithFixed.filter(
            (e) =>
              e.classId === c.id &&
              e.sectionId === sec.id &&
              e.subjectId === m.subjectId
          ).length;

          const remaining = Number(m.periodsPerWeek) - alreadyPlaced;
          if (remaining <= 0) return;

          const tids = [
            ...new Set(
              teacherMappings
                .filter(
                  (tm) =>
                    tm.classId === c.id &&
                    tm.sectionId === sec.id &&
                    tm.subjectId === m.subjectId
                )
                .map((tm) => tm.teacherId)
            ),
          ].filter((id) => teachers.some((t) => t.id === id));

                   const desiredDoubles = Math.max(
            0,
            Math.floor(Number(m.doublePeriods) || 0)
          );
          const doubleRemaining = Math.min(
            desiredDoubles,
            Math.floor(remaining / 2)
          );

          requirements.push({
            classId: c.id,
            sectionId: sec.id,
            subjectId: m.subjectId,
            remaining,
            doubleRemaining,
            teachers: tids,
            cursor: 0,
            lastIdx: -99,
          });
        });
    });
  });

      const teacherLoad = (tid) => {
    let n = 0;
    for (const key of busyTeachers) {
      if (key.endsWith(`::${tid}`)) n += 1;
    }
    return n;
  };

  const isTeacherAtDailyLimit = (tid, day) => {
    if (maxTeacherPeriodsPerDay <= 0) return false; // 0 means no limit
    return (teacherDayCounts.get(`${day}::${tid}`) || 0) >= maxTeacherPeriodsPerDay;
  };

  // ---------------------------------------------------------------
  // Option Sets — a set of subjects placed together in the same slot.
  // ---------------------------------------------------------------
  const optionRequirements = optionSets
    .filter((s) => s.active !== false)
    .map((set) => {
      const subjectsWithTeachers = (set.subjectIds || []).map((subId) => {
        const tids = [
          ...new Set(
            teacherMappings
              .filter(
                (tm) =>
                  tm.classId === set.classId &&
                  tm.subjectId === subId
              )
              .map((tm) => tm.teacherId)
          ),
        ].filter((id) => teachers.some((t) => t.id === id));
        return { subjectId: subId, teachers: tids };
      });

      return {
        setId: set.id,
        classId: set.classId,
        subjectsWithTeachers,
        remaining: Number(set.periodsPerWeek) || 0,
      };
    })
    .filter((req) => 
      req.remaining > 0 && 
      req.subjectsWithTeachers.length > 0 && 
      req.subjectsWithTeachers.every((s) => s.teachers.length > 0)
    );

  // ---------------------------------------------------------------
  // Slot filling — day → period → class → section
  // ---------------------------------------------------------------
  const newEntries = [];

  for (const day of days) {
    for (let pi = 0; pi < periods.length; pi++) {
      const period = periods[pi];

      for (const c of classes) {
        for (const sec of getSections(c)) {
          const occupied = [...baseWithFixed, ...newEntries].some(
            (e) =>
              e.day === day &&
              e.classId === c.id &&
              e.sectionId === sec.id &&
              e.periodId === period.id
          );
                    if (occupied) continue;

          // ── Option Set placement ────────────────────────────
          let optionSetPlaced = false;
          for (const setReq of optionRequirements) {
            if (setReq.classId !== c.id) continue;
            if (setReq.remaining <= 0) continue;

            // Check if all teachers for all subjects in the set are free.
            const picks = [];
            let allFree = true;
            for (const sub of setReq.subjectsWithTeachers) {
              let pick = null;
                            for (const tid of sub.teachers) {
                if (
                  !busyTeachers.has(`${day}::${period.id}::${tid}`) &&
                  !isTeacherAtDailyLimit(tid, day)
                ) {
                  pick = tid;
                  break;
                }
              }
              if (!pick) {
                allFree = false;
                break;
              }
              picks.push({ subjectId: sub.subjectId, teacherId: pick });
            }

            if (!allFree) continue;

                        for (const p of picks) {
              const entry = {
                id: makeId(),
                day,
                classId: c.id,
                sectionId: sec.id,
                periodId: period.id,
                subjectId: p.subjectId,
                teacherId: p.teacherId,
                parallelGroup: setReq.setId, // Store the set ID
                updatedAt: new Date().toISOString(),
              };
              newEntries.push(entry);
              trackEntry(entry);
            }
            setReq.remaining -= 1;
            optionSetPlaced = true;
            break;
          }

          if (optionSetPlaced) continue;

          const candidates = requirements.filter((r) => {
            if (r.classId !== c.id || r.sectionId !== sec.id) return false;
            if (r.remaining <= 0) return false;
            if (!r.teachers.length) return false;
            const sdKey = `${c.id}::${sec.id}::${r.subjectId}::${day}`;
            if (
              maxPerDay > 0 &&
              (subjectDayCounts.get(sdKey) || 0) >= maxPerDay
            ) {
              return false;
            }
            return true;
          });
          if (!candidates.length) continue;

                    candidates.sort((a, b) => {
            // Double-period requirements go first so they can claim
            // adjacent pairs before a single-period requirement takes
            // the second half of the pair.
            if (a.doubleRemaining > 0 && b.doubleRemaining === 0) return -1;
            if (a.doubleRemaining === 0 && b.doubleRemaining > 0) return 1;

            if (avoidConsecutive) {
              const ac = a.lastIdx === pi - 1 ? 1 : 0;
              const bc = b.lastIdx === pi - 1 ? 1 : 0;
              if (ac !== bc) return ac - bc;
            }
            if (a.remaining !== b.remaining) return b.remaining - a.remaining;
            if (balanceWorkload) {
              const al = Math.min(...a.teachers.map(teacherLoad));
              const bl = Math.min(...b.teachers.map(teacherLoad));
              if (al !== bl) return al - bl;
            }
            return 0;
          });

          for (const req of candidates) {
            let chosen = null;
                        for (let k = 0; k < req.teachers.length; k++) {
              const idx = (req.cursor + k) % req.teachers.length;
              const tid = req.teachers[idx];
              if (
                !busyTeachers.has(`${day}::${period.id}::${tid}`) &&
                !isTeacherAtDailyLimit(tid, day)
              ) {
                chosen = { tid, idx };
                break;
              }
            }
            if (!chosen) continue;

            // ── Try placing as a double period first ────────────────
            // A double requires: the next teaching period exists, its
            // slot is free in this section, and the chosen teacher is
            // free in that next period too. If any of those fail, we
            // fall through to a single-period placement.
            let placedAsDouble = false;
            if (req.doubleRemaining > 0) {
              const nextPeriod = periods[pi + 1];
              if (nextPeriod) {
                const nextSlotOccupied = [
                  ...baseWithFixed,
                  ...newEntries,
                ].some(
                  (e) =>
                    e.day === day &&
                    e.classId === c.id &&
                    e.sectionId === sec.id &&
                    e.periodId === nextPeriod.id
                );
                const teacherFreeNext = !busyTeachers.has(
                  `${day}::${nextPeriod.id}::${chosen.tid}`
                );

                if (!nextSlotOccupied && teacherFreeNext) {
                  const entry1 = {
                    id: makeId(),
                    day,
                    classId: c.id,
                    sectionId: sec.id,
                    periodId: period.id,
                    subjectId: req.subjectId,
                    teacherId: chosen.tid,
                    updatedAt: new Date().toISOString(),
                  };
                  const entry2 = {
                    id: makeId(),
                    day,
                    classId: c.id,
                    sectionId: sec.id,
                    periodId: nextPeriod.id,
                    subjectId: req.subjectId,
                    teacherId: chosen.tid,
                    updatedAt: new Date().toISOString(),
                  };
                  newEntries.push(entry1, entry2);
                  trackEntry(entry1);
                  trackEntry(entry2);
                  req.remaining -= 2;
                  req.doubleRemaining -= 1;
                  req.cursor = (chosen.idx + 1) % req.teachers.length;
                  req.lastIdx = pi + 1;
                  placedAsDouble = true;
                }
              }
            }

            if (placedAsDouble) break;

            // ── Fall back to a single period ───────────────────────
            const entry = {
              id: makeId(),
              day,
              classId: c.id,
              sectionId: sec.id,
              periodId: period.id,
              subjectId: req.subjectId,
              teacherId: chosen.tid,
              updatedAt: new Date().toISOString(),
            };
            newEntries.push(entry);
            trackEntry(entry);
            req.remaining -= 1;
            req.cursor = (chosen.idx + 1) % req.teachers.length;
            req.lastIdx = pi;
            break;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // Apply — merge with base or replace it, per mode
  // ---------------------------------------------------------------
  const finalTimetable =
  mode === "empty"
    ? [
        ...existingTimetable.filter(
          (e) => !fixedPlacements.some((f) => f.id === e.id)
        ),
        ...fixedPlacements,
        ...newEntries,
      ]
    : // "full" mode keeps manually-locked (fixed) entries and regenerates
      // everything else around them.
      [...base, ...fixedPlacements, ...newEntries];

      const unplaced = requirements.filter(
    (r) => r.remaining > 0 || r.doubleRemaining > 0
  );
  
  let unplacedOptionSetCount = 0;
  optionRequirements.forEach((r) => {
    if (r.remaining > 0) unplacedOptionSetCount += r.remaining;
  });

  return {
    ok: true,
    timetable: finalTimetable,
    newEntriesCount: newEntries.length,
    fixedCount: fixedPlacements.length,
    unplacedCount: unplaced.length + unplacedOptionSetCount,
    unplacedGroups: unplaced.map((r) => ({
      classId: r.classId,
      sectionId: r.sectionId,
      subjectId: r.subjectId,
      remaining: r.remaining,
    })),
    mode,
  };
}