import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Download, Printer,
  School, Users, UserRound, CalendarRange, ArrowLeftRight,
  Wand2, GripVertical, ListChecks, RotateCcw, Clock, Pin, Trash2,
} from "lucide-react";
import "../styles/timetable-builder.css";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const safeArray = (v) => (Array.isArray(v) ? v : []);
const safeObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const getName = (items, id, fallback = "—") =>
  items.find((i) => i.id === id)?.name || fallback;
const getSections = (c) =>
  safeArray(c?.sections).filter((s) => s.active !== false);
const timeText = (i) => (i?.start && i?.end ? `${i.start}–${i.end}` : "");
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
const cellToHtml = (v) => escapeHtml(v).replace(/\n/g, "<br>");

function getSchedule(project) {
  return safeArray(project?.data?.bellSchedule?.schedule)
    .map((item, i) => (item && typeof item === "object" ? {
      ...item,
      id: item.id || `legacy-${item.type || "item"}-${i + 1}`,
      name: item.name || (item.type === "break" ? "Break" : `Period ${i + 1}`),
    } : null))
    .filter((i) => i && (i.type === "period" || i.type === "break"));
}

function getDays(project) {
  const d = safeArray(project?.data?.school?.workingDays);
  return d.length
    ? d
    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
}

const slotKey = (day, classId, sectionId, periodId) =>
  `${day}::${classId}::${sectionId}::${periodId}`;

function buildPrintableHtml({ title, schoolName, academicYear, headers, rows }) {
  const headerHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((c) => `<td>${cellToHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111;margin:0}
    h2{text-align:center;font-size:16px;margin:0 0 4px}
    h3{text-align:center;font-size:13px;margin:0 0 10px;font-weight:600}
    .meta{text-align:center;font-size:10px;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid #333;padding:5px 3px;text-align:center;vertical-align:middle;font-size:9px;overflow-wrap:anywhere}
    th{background:#eef2f7;font-weight:700}
    td:first-child,th:first-child{width:12%}
    .break{background:#f1f1f1;font-weight:700}
    @media print{tr{break-inside:avoid}thead{display:table-header-group}}
  </style></head><body>
    <h2>${escapeHtml(schoolName || "School")}</h2>
    <h3>${escapeHtml(title)}</h3>
    <div class="meta">Academic Year: ${escapeHtml(academicYear || "")}</div>
    <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>window.onload=()=>window.print()</script>
  </body></html>`;
}

function openPrintDocument(html) {
  const w = window.open("", "_blank", "width=1200,height=850");
  if (!w) return alert("Please allow pop-ups for printing.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function TimetableBuilder({
  project,
  onSaveTimetable,
  onSaveSubstitutions,
  onSaveTimetableSettings,
}) {
  const projectId = project?.id;

  const classes = useMemo(
    () => safeArray(project?.data?.classes).filter((i) => i.active !== false),
    [project?.data?.classes]
  );
  const subjects = useMemo(
    () => safeArray(project?.data?.subjects).filter((i) => i.active !== false),
    [project?.data?.subjects]
  );
  const teachers = useMemo(
    () => safeArray(project?.data?.teachers).filter((i) => i.active !== false),
    [project?.data?.teachers]
  );
  const subjectMappings = useMemo(
    () => safeArray(project?.data?.mappings),
    [project?.data?.mappings]
  );
  const teacherMappings = useMemo(
    () => safeArray(project?.data?.teacherMappings),
    [project?.data?.teacherMappings]
  );
  const schedule = useMemo(
    () => getSchedule(project),
    [project?.data?.bellSchedule]
  );
  const periods = useMemo(
    () => schedule.filter((i) => i.type === "period"),
    [schedule]
  );
  const days = useMemo(
    () => getDays(project),
    [project?.data?.school?.workingDays]
  );

  const [view, setView] = useState("class");
  const [timetable, setTimetable] = useState(() =>
    safeArray(project?.data?.timetable)
  );
  const [substitutions, setSubstitutions] = useState(() =>
    safeArray(project?.data?.substitutions)
  );
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("info");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [subDay, setSubDay] = useState(days[0] || "Monday");
  const [selectedDay, setSelectedDay] = useState(days[0] || "Monday");
  const [absentTeacherIds, setAbsentTeacherIds] = useState([]);
  const [searchAbsent, setSearchAbsent] = useState("");
  const [showAbsentList, setShowAbsentList] = useState(false);

  const savedSettings = safeObject(project?.data?.timetableSettings);
  const [genMode, setGenMode] = useState(() => savedSettings.genMode || "empty");
  const [genConfig, setGenConfig] = useState(() => ({
    maxPerDay: savedSettings.genConfig?.maxPerDay ?? 2,
    avoidConsecutive: savedSettings.genConfig?.avoidConsecutive ?? true,
    balanceWorkload: savedSettings.genConfig?.balanceWorkload ?? true,
  }));
  const [fixedRules, setFixedRules] = useState(() =>
    safeArray(savedSettings.fixedRules)
  );
  const [fixDraft, setFixDraft] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
    day: days[0] || "Monday",
    periodId: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const draggedSlot = useRef(null);
  const saveTimetableRef = useRef(onSaveTimetable);
  const saveSubstitutionsRef = useRef(onSaveSubstitutions);
  const saveSettingsRef = useRef(onSaveTimetableSettings);

  // Always-current value refs (used by the unmount flush).
  const timetableRef = useRef(timetable);
  timetableRef.current = timetable;
  const substitutionsRef = useRef(substitutions);
  substitutionsRef.current = substitutions;
  const settingsRef = useRef({ genMode, genConfig, fixedRules });
  settingsRef.current = { genMode, genConfig, fixedRules };

  useEffect(() => { saveTimetableRef.current = onSaveTimetable; }, [onSaveTimetable]);
  useEffect(() => { saveSubstitutionsRef.current = onSaveSubstitutions; }, [onSaveSubstitutions]);
  useEffect(() => { saveSettingsRef.current = onSaveTimetableSettings; }, [onSaveTimetableSettings]);

  /* Reload project data on project switch. Skip on the initial mount since
     useState already used the same data. */
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setTimetable(safeArray(project?.data?.timetable));
    setSubstitutions(safeArray(project?.data?.substitutions));
    setAbsentTeacherIds([]);
    setShowAbsentList(false);
    setSearchAbsent("");
    const d = getDays(project);
    setSubDay(d[0] || "Monday");
    setSelectedDay(d[0] || "Monday");
    const s = safeObject(project?.data?.timetableSettings);
    setGenMode(s.genMode || "empty");
    setGenConfig({
      maxPerDay: s.genConfig?.maxPerDay ?? 2,
      avoidConsecutive: s.genConfig?.avoidConsecutive ?? true,
      balanceWorkload: s.genConfig?.balanceWorkload ?? true,
    });
    setFixedRules(safeArray(s.fixedRules));
    setFixDraft({
      classId: "",
      sectionId: "",
      subjectId: "",
      day: d[0] || "Monday",
      periodId: "",
    });
    setNotice("");
    setSaveStatus("saved");
  }, [projectId]);

  /* Unmount flush — guarantees that quick navigation never loses work. */
  useEffect(() => {
    return () => {
      saveTimetableRef.current?.(timetableRef.current);
      saveSubstitutionsRef.current?.(substitutionsRef.current);
      saveSettingsRef.current?.(settingsRef.current);
    };
  }, []);

  /* Auto-save timetable (skip first render). */
  const skipNextTimetableSave = useRef(true);
  useEffect(() => {
    if (skipNextTimetableSave.current) {
      skipNextTimetableSave.current = false;
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      try {
        const result = saveTimetableRef.current?.(timetable);
        if (result && typeof result.then === "function") {
          result.then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error"));
        } else {
          setSaveStatus("saved");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [timetable]);

  /* Auto-save substitutions (skip first render). */
  const skipNextSubSave = useRef(true);
  useEffect(() => {
    if (skipNextSubSave.current) {
      skipNextSubSave.current = false;
      return;
    }
    const t = setTimeout(
      () => saveSubstitutionsRef.current?.(substitutions),
      450
    );
    return () => clearTimeout(t);
  }, [substitutions]);

  /* Auto-save generator settings (skip first render). */
  const skipNextSettingsSave = useRef(true);
  useEffect(() => {
    if (skipNextSettingsSave.current) {
      skipNextSettingsSave.current = false;
      return;
    }
    const t = setTimeout(
      () => saveSettingsRef.current?.({ genMode, genConfig, fixedRules }),
      450
    );
    return () => clearTimeout(t);
  }, [genMode, genConfig, fixedRules]);

  /* ------------------------------------------------------------------ */
  /* lookup maps                                                        */
  /* ------------------------------------------------------------------ */
  const entryMap = useMemo(() => {
    const m = new Map();
    timetable.forEach((e) =>
      m.set(slotKey(e.day, e.classId, e.sectionId, e.periodId), e)
    );
    return m;
  }, [timetable]);

  const substitutionMap = useMemo(() => {
    const m = new Map();
    substitutions.forEach((s) => m.set(s.timetableEntryId, s));
    return m;
  }, [substitutions]);

  const getEntry = (day, classId, sectionId, periodId) =>
    entryMap.get(slotKey(day, classId, sectionId, periodId));

  const getSubstitution = (entry) => substitutionMap.get(entry.id);
  const effectiveTeacherId = (entry) =>
    getSubstitution(entry)?.substituteTeacherId || entry.teacherId;

  const getMappedSubjects = (classId) =>
    subjectMappings.filter(
      (m) =>
        m.classId === classId &&
        subjects.some((s) => s.id === m.subjectId) &&
        Number(m.periodsPerWeek) > 0
    );

  function getMappedTeacher(classId, sectionId, subjectId) {
    const matches = teacherMappings.filter(
      (m) =>
        m.classId === classId &&
        m.sectionId === sectionId &&
        m.subjectId === subjectId &&
        teachers.some((t) => t.id === m.teacherId)
    );
    const unique = [...new Map(matches.map((m) => [m.teacherId, m])).values()];
    return {
      teacher:
        unique.length === 1
          ? teachers.find((t) => t.id === unique[0].teacherId)
          : null,
      count: unique.length,
      options: unique
        .map((m) => ({
          teacher: teachers.find((t) => t.id === m.teacherId),
          subjectCode: m.subjectCode || "",
          periodsAllocated: Number(m.periodsAllocated || 0),
        }))
        .filter((x) => x.teacher),
    };
  }

  /**
   * True if `teacherId` already teaches at (day, periodId).
   * `excludeIds` accepts an array of timetable entry ids that should be
   * ignored — required for swaps where both the moving entries must be
   * excluded from the "busy" check.
   */
  function teacherIsBusy(teacherId, day, periodId, excludeIds = []) {
    if (!teacherId) return false;
    const ids = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
    return timetable.some(
      (e) =>
        !ids.includes(e.id) &&
        e.day === day &&
        e.periodId === periodId &&
        effectiveTeacherId(e) === teacherId
    );
  }

  function flash(kind, text) {
    setNoticeKind(kind);
    setNotice(text);
  }

  /* ------------------------------------------------------------------ */
  /* manual editing                                                     */
  /* ------------------------------------------------------------------ */
  function saveSlot(
    day,
    classId,
    sectionId,
    periodId,
    subjectId,
    selectedTeacherId = ""
  ) {
    const mapped = getMappedTeacher(classId, sectionId, subjectId);
    const existing = getEntry(day, classId, sectionId, periodId);

    if (!subjectId) {
      if (existing) {
        setTimetable((p) => p.filter((e) => e.id !== existing.id));
        setSubstitutions((p) =>
          p.filter((s) => s.timetableEntryId !== existing.id)
        );
      }
      setNotice("");
      return;
    }

    let teacherId = selectedTeacherId || mapped.teacher?.id || "";
    const exclude = existing ? [existing.id] : [];

    if (teacherId && teacherIsBusy(teacherId, day, periodId, exclude)) {
      const t = teachers.find((x) => x.id === teacherId);
      flash(
        "warn",
        `${t?.name || "Selected teacher"} is already teaching in another class this period. The slot is saved without a teacher.`
      );
      teacherId = "";
    } else if (mapped.count > 1 && !teacherId) {
      flash(
        "warn",
        "Multiple teachers are mapped. Pick one from the teacher dropdown."
      );
    } else {
      setNotice("");
    }

    const record = {
      id: existing?.id || makeId(),
      day,
      classId,
      sectionId,
      periodId,
      subjectId,
      teacherId,
      updatedAt: new Date().toISOString(),
    };

    setTimetable((p) =>
      existing
        ? p.map((e) => (e.id === existing.id ? record : e))
        : [...p, record]
    );
    if (existing) {
      setSubstitutions((p) =>
        p.filter((s) => s.timetableEntryId !== existing.id)
      );
    }
  }

  function clearSlot(entry) {
    setTimetable((p) => p.filter((e) => e.id !== entry.id));
    setSubstitutions((p) =>
      p.filter((s) => s.timetableEntryId !== entry.id)
    );
    flash("info", "Period cleared.");
  }

  function placedCount(classId, sectionId, subjectId) {
    return timetable.filter(
      (e) =>
        e.classId === classId &&
        e.sectionId === sectionId &&
        e.subjectId === subjectId
    ).length;
  }

  /* ------------------------------------------------------------------ */
  /* drag and drop                                                      */
  /* ------------------------------------------------------------------ */
  function handleDragStart(e, day, classId, sectionId, periodId) {
    const entry = getEntry(day, classId, sectionId, periodId);
    if (!entry) {
      e.preventDefault();
      return;
    }
    draggedSlot.current = { day, classId, sectionId, periodId, id: entry.id };
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e, day, classId, sectionId, periodId) {
    e.preventDefault();
    const src = draggedSlot.current;
    draggedSlot.current = null;
    if (!src) return;
    if (
      src.day === day &&
      src.classId === classId &&
      src.sectionId === sectionId &&
      src.periodId === periodId
    )
      return;

    const srcEntry = getEntry(src.day, src.classId, src.sectionId, src.periodId);
    if (!srcEntry) return;
    const dstEntry = getEntry(day, classId, sectionId, periodId);

    // Both entries are being swapped/moved — exclude them from busy checks.
    const exclude = [srcEntry.id, dstEntry?.id].filter(Boolean);

    const srcTeacherId = effectiveTeacherId(srcEntry);
    const dstTeacherId = dstEntry ? effectiveTeacherId(dstEntry) : "";

    // Do not move a subject into a class/section where it is not mapped.
    if (!subjectMappings.some(
      (m) => m.classId === classId && m.subjectId === srcEntry.subjectId &&
        Number(m.periodsPerWeek) > 0
    )) {
      return flash("error", "Cannot move: this subject is not mapped to the destination class.");
    }
    if (srcTeacherId && !teacherMappings.some(
      (m) => m.classId === classId && m.sectionId === sectionId &&
        m.subjectId === srcEntry.subjectId && m.teacherId === srcTeacherId
    )) {
      return flash("error", "Cannot move: this teacher is not mapped to the destination section for this subject.");
    }
    if (dstEntry && !subjectMappings.some(
      (m) => m.classId === src.classId && m.subjectId === dstEntry.subjectId &&
        Number(m.periodsPerWeek) > 0
    )) {
      return flash("error", "Cannot swap: the destination subject is not mapped to the source class.");
    }
    if (dstEntry && dstTeacherId && !teacherMappings.some(
      (m) => m.classId === src.classId && m.sectionId === src.sectionId &&
        m.subjectId === dstEntry.subjectId && m.teacherId === dstTeacherId
    )) {
      return flash("error", "Cannot swap: the destination teacher is not mapped to the source section for this subject.");
    }

    if (
      srcTeacherId &&
      teacherIsBusy(srcTeacherId, day, periodId, exclude)
    ) {
      return flash(
        "error",
        "Cannot move: the teacher is already teaching at the destination period."
      );
    }
    if (
      dstTeacherId &&
      teacherIsBusy(dstTeacherId, src.day, src.periodId, exclude)
    ) {
      return flash(
        "error",
        "Cannot swap: the destination teacher is already teaching at the source period."
      );
    }

    setTimetable((prev) => {
      const next = prev.filter(
        (e) => e.id !== srcEntry.id && e.id !== dstEntry?.id
      );
      next.push({
        ...srcEntry,
        day,
        classId,
        sectionId,
        periodId,
        updatedAt: new Date().toISOString(),
      });
      if (dstEntry) {
        next.push({
          ...dstEntry,
          day: src.day,
          classId: src.classId,
          sectionId: src.sectionId,
          periodId: src.periodId,
          updatedAt: new Date().toISOString(),
        });
      }
      return next;
    });
    setSubstitutions((prev) =>
      prev.filter(
        (s) =>
          s.timetableEntryId !== srcEntry.id &&
          s.timetableEntryId !== dstEntry?.id
      )
    );
    flash("info", dstEntry ? "Periods swapped." : "Period moved.");
  }

  /* ------------------------------------------------------------------ */
  /* fixed-rule drafting                                                */
  /* ------------------------------------------------------------------ */
  const fixSections = useMemo(() => {
    const c = classes.find((x) => x.id === fixDraft.classId);
    return getSections(c);
  }, [classes, fixDraft.classId]);

  const fixSubjects = useMemo(
    () => (fixDraft.classId ? getMappedSubjects(fixDraft.classId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixDraft.classId, subjectMappings, subjects]
  );

  function resetFixDraft() {
    setFixDraft({
      classId: "",
      sectionId: "",
      subjectId: "",
      day: days[0] || "Monday",
      periodId: "",
    });
  }

  function addFixedRule() {
    if (
      !fixDraft.classId ||
      !fixDraft.sectionId ||
      !fixDraft.subjectId ||
      !fixDraft.day ||
      !fixDraft.periodId
    ) {
      return flash(
        "warn",
        "Choose class, section, subject, day and period before adding a fixed rule."
      );
    }
    if (
      fixedRules.some(
        (r) =>
          r.classId === fixDraft.classId &&
          r.sectionId === fixDraft.sectionId &&
          r.day === fixDraft.day &&
          r.periodId === fixDraft.periodId
      )
    ) {
      return flash(
        "warn",
        "A rule already targets that class, section and slot."
      );
    }
    setFixedRules((prev) => [...prev, { id: makeId(), ...fixDraft }]);
    resetFixDraft();
    setNotice("");
  }

  function removeFixedRule(id) {
    setFixedRules((prev) => prev.filter((r) => r.id !== id));
  }

  /* ------------------------------------------------------------------ */
  /* AUTO GENERATION                                                    */
  /* ------------------------------------------------------------------ */
  function autoGenerate() {
    if (
      !periods.length ||
      !classes.length ||
      !subjects.length ||
      !teachers.length
    ) {
      return flash(
        "error",
        "Complete Bell Schedule, Classes, Subjects and Teachers first."
      );
    }
    // Pre-flight validation: report actionable data issues before generation.
    const activeSectionCount = classes.reduce((sum, c) => sum + getSections(c).length, 0);
    if (!activeSectionCount) {
      return flash("error", "No active class sections are available. Add/activate sections first.");
    }
    const slotCapacity = activeSectionCount * periods.length * days.length;
    const weeklyDemand = classes.reduce((sum, c) => {
      const sectionCount = getSections(c).length;
      return sum + sectionCount * subjectMappings
        .filter((m) => m.classId === c.id && subjects.some((s) => s.id === m.subjectId))
        .reduce((n, m) => n + Math.max(0, Number(m.periodsPerWeek) || 0), 0);
    }, 0);
    if (weeklyDemand > slotCapacity && genMode === "full") {
      return flash("error", `Weekly subject demand (${weeklyDemand}) exceeds available class slots (${slotCapacity}). Reduce periods/week or add periods/days.`);
    }

    setIsGenerating(true);

    // 1. Base = existing timetable (fill mode) or empty (regenerate all).
    const base = genMode === "empty" ? [...timetable] : [];

    // 2. Trackers.
    const busyTeachers = new Set();
    const subjectDayCounts = new Map();
    const lastPeriodOf = new Map();

    const trackEntry = (e) => {
      // Substitutions also occupy the slot: generation must not schedule
      // the substitute teacher elsewhere at the same day/period.
      const occupiedTeacherId = effectiveTeacherId(e);
      if (occupiedTeacherId)
        busyTeachers.add(`${e.day}::${e.periodId}::${occupiedTeacherId}`);
      const sdKey = `${e.classId}::${e.sectionId}::${e.subjectId}::${e.day}`;
      subjectDayCounts.set(sdKey, (subjectDayCounts.get(sdKey) || 0) + 1);
      const lastKey = `${e.classId}::${e.sectionId}::${e.subjectId}`;
      const pi = periods.findIndex((p) => p.id === e.periodId);
      lastPeriodOf.set(lastKey, pi);
    };
    base.forEach(trackEntry);

    // 3. Fixed rules first — skip if slot occupied by base OR another fixed rule.
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
        (m) => m.classId === rule.classId && m.subjectId === rule.subjectId &&
          Number(m.periodsPerWeek) > 0
      );
      const ruleClass = classes.find((c) => c.id === rule.classId);
      if (!subjectMapping || !getSections(ruleClass).some((s) => s.id === rule.sectionId) ||
          !days.includes(rule.day) || !periods.some((p) => p.id === rule.periodId)) return;

      // A fixed rule must not schedule beyond the subject's weekly quota.
      const subjectPlacedCount = [...base, ...fixedPlacements].filter(
        (e) => e.classId === rule.classId &&
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

    // 4. Build remaining requirements. Count ALL existing slots for a subject
    //    (including any without a teacher) so we don't over-schedule.
    const requirements = [];
    classes.forEach((c) => {
      getSections(c).forEach((sec) => {
        subjectMappings
          .filter((m) => m.classId === c.id && Number(m.periodsPerWeek) > 0)
          .forEach((m) => {
            if (!subjects.some((s) => s.id === m.subjectId)) return;

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

            requirements.push({
              classId: c.id,
              sectionId: sec.id,
              subjectId: m.subjectId,
              remaining,
              teachers: tids,
              cursor: 0,
              lastIdx: -99,
            });
          });
      });
    });

    // Precomputed workload helper — clear and fast enough for typical schools.
    const teacherLoad = (tid) => {
      let n = 0;
      for (const key of busyTeachers) {
        if (key.endsWith(`::${tid}`)) n += 1;
      }
      return n;
    };

    // 5. Fill slots in deterministic order: day → period → class → section.
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

            const candidates = requirements.filter((r) => {
              if (r.classId !== c.id || r.sectionId !== sec.id) return false;
              if (r.remaining <= 0) return false;
              if (!r.teachers.length) return false;
              const sdKey = `${c.id}::${sec.id}::${r.subjectId}::${day}`;
              if (
                genConfig.maxPerDay > 0 &&
                (subjectDayCounts.get(sdKey) || 0) >= genConfig.maxPerDay
              )
                return false;
              return true;
            });
            if (!candidates.length) continue;

            candidates.sort((a, b) => {
              if (genConfig.avoidConsecutive) {
                const ac = a.lastIdx === pi - 1 ? 1 : 0;
                const bc = b.lastIdx === pi - 1 ? 1 : 0;
                if (ac !== bc) return ac - bc;
              }
              if (a.remaining !== b.remaining)
                return b.remaining - a.remaining;
              if (genConfig.balanceWorkload) {
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
                if (!busyTeachers.has(`${day}::${period.id}::${tid}`)) {
                  chosen = { tid, idx };
                  break;
                }
              }
              if (!chosen) continue;

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

    // 6. Apply.
    const finalTimetable =
      genMode === "empty"
        ? [
            ...timetable.filter(
              (e) => !fixedPlacements.some((f) => f.id === e.id)
            ),
            ...fixedPlacements,
            ...newEntries,
          ]
        : [...fixedPlacements, ...newEntries];

    setTimetable(finalTimetable);

    // Preserve substitutions in "fill empty" mode; only clear for regenerate-all.
    if (genMode === "full") {
      setSubstitutions([]);
    } else {
      const keptIds = new Set(finalTimetable.map((e) => e.id));
      setSubstitutions((prev) =>
        prev.filter((s) => keptIds.has(s.timetableEntryId))
      );
    }

    setIsGenerating(false);

    const unplaced = requirements.filter((r) => r.remaining > 0);
    let msg = `Generated ${newEntries.length} new period${
      newEntries.length === 1 ? "" : "s"
    }${
      fixedPlacements.length
        ? ` (plus ${fixedPlacements.length} fixed)`
        : ""
    }.`;
    if (unplaced.length) {
      msg += ` ${unplaced.length} subject-section(s) could not be fully placed (clash or insufficient slots).`;
    }
    flash(unplaced.length ? "warn" : "success", msg);
  }

  /* ------------------------------------------------------------------ */
  /* PDF exports                                                        */
  /* ------------------------------------------------------------------ */
  function downloadSectionPdf(classItem, section) {
    const headers = [
      "Day",
      ...schedule.map(
        (i) => `${i.name}${timeText(i) ? ` (${timeText(i)})` : ""}`
      ),
    ];
    const rows = days.map((day) => [
      day,
      ...schedule.map((item) => {
        if (item.type === "break") return item.name;
        const entry = getEntry(day, classItem.id, section.id, item.id);
        if (!entry) return "—";
        const code =
          getMappedTeacher(classItem.id, section.id, entry.subjectId).options.find(
            (o) => o.teacher.id === entry.teacherId
          )?.subjectCode || "";
        return `${getName(subjects, entry.subjectId)}${
          code ? ` (${code})` : ""
        }\n${
          entry.teacherId
            ? getName(teachers, entry.teacherId)
            : "Teacher not assigned"
        }`;
      }),
    ]);
    openPrintDocument(
      buildPrintableHtml({
        title: `CLASS ${classItem.name} – SECTION ${section.name} TIMETABLE`,
        schoolName: project?.data?.school?.schoolName || project?.schoolName,
        academicYear:
          project?.data?.school?.academicYear || project?.academicYear,
        headers,
        rows,
      })
    );
  }

  function downloadTeacherPdf(teacher) {
    const headers = [
      "Day",
      ...schedule.map(
        (i) => `${i.name}${timeText(i) ? ` (${timeText(i)})` : ""}`
      ),
    ];
    const rows = days.map((day) => [
      day,
      ...schedule.map((item) => {
        if (item.type === "break") return item.name;
        const entry = timetable.find(
          (c) =>
            c.day === day &&
            c.periodId === item.id &&
            effectiveTeacherId(c) === teacher.id
        );
        return entry
          ? `${getName(subjects, entry.subjectId)}\n${getName(
              classes,
              entry.classId
            )}-${getName(
              getSections(classes.find((c) => c.id === entry.classId)),
              entry.sectionId
            )}`
          : "—";
      }),
    ]);
    openPrintDocument(
      buildPrintableHtml({
        title: `TEACHER TIMETABLE – ${teacher.name}`,
        schoolName: project?.data?.school?.schoolName || project?.schoolName,
        academicYear:
          project?.data?.school?.academicYear || project?.academicYear,
        headers,
        rows,
      })
    );
  }

  /* ------------------------------------------------------------------ */
  /* substitutions                                                      */
  /* ------------------------------------------------------------------ */
  const getDayEntries = (day) => timetable.filter((e) => e.day === day);

  function teacherFreePeriods(teacherId, day) {
    return periods.filter(
      (p) =>
        !timetable.some(
          (e) =>
            e.day === day &&
            e.periodId === p.id &&
            effectiveTeacherId(e) === teacherId
        )
    ).length;
  }

  function isFreeForSubstitution(teacherId, day, periodId) {
    if (absentTeacherIds.includes(teacherId)) return false;
    const alreadySub = substitutions.some(
      (s) =>
        s.day === day &&
        s.periodId === periodId &&
        s.substituteTeacherId === teacherId
    );
    return (
      !alreadySub &&
      !timetable.some(
        (e) =>
          e.day === day &&
          e.periodId === periodId &&
          effectiveTeacherId(e) === teacherId
      )
    );
  }

  function assignSubstitute(absentTeacherId, absentEntry, substituteTeacherId) {
    if (!substituteTeacherId) {
      setSubstitutions((p) =>
        p.filter(
          (s) => !(s.day === subDay && s.timetableEntryId === absentEntry.id)
        )
      );
      return;
    }
    if (
      !isFreeForSubstitution(
        substituteTeacherId,
        subDay,
        absentEntry.periodId
      )
    ) {
      return flash("error", "This teacher is not free in the selected period.");
    }
    const record = {
      id: makeId(),
      timetableEntryId: absentEntry.id,
      day: subDay,
      periodId: absentEntry.periodId,
      classId: absentEntry.classId,
      sectionId: absentEntry.sectionId,
      subjectId: absentEntry.subjectId,
      originalTeacherId: absentTeacherId,
      substituteTeacherId,
      reason: "Absent teacher",
    };
    setSubstitutions((p) => [
      ...p.filter(
        (s) => !(s.day === subDay && s.timetableEntryId === absentEntry.id)
      ),
      record,
    ]);
    setNotice("");
  }

  /* ------------------------------------------------------------------ */
  /* summaries                                                          */
  /* ------------------------------------------------------------------ */
  const clashGroups = useMemo(() => {
    const counts = new Map();
    timetable.forEach((e) => {
      if (!e.teacherId) return;
      const key = `${e.day}::${e.periodId}::${effectiveTeacherId(e)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.values()].filter((n) => n > 1).length;
  }, [timetable, substitutions]);

  const workload = useMemo(() => {
    const map = new Map();
    teachers.forEach((t) =>
      map.set(t.id, {
        teacher: t,
        periods: 0,
        classes: new Set(),
        subjects: new Set(),
      })
    );
    timetable.forEach((e) => {
      const assignedTeacherId = effectiveTeacherId(e);
      if (!assignedTeacherId) return;
      const row = map.get(assignedTeacherId);
      if (!row) return;
      row.periods += 1;
      row.classes.add(e.classId);
      row.subjects.add(e.subjectId);
    });
    return [...map.values()].sort((a, b) => b.periods - a.periods);
  }, [timetable, teachers]);

  const totalSlots =
    classes.reduce((sum, c) => sum + getSections(c).length, 0) *
    periods.length *
    days.length;

  const assignedCount = useMemo(
    () =>
      timetable.filter(
        (e) => e.subjectId && teachers.some((t) => t.id === effectiveTeacherId(e))
      ).length,
    [timetable, teachers]
  );

  /* ------------------------------------------------------------------ */
  /* renderers                                                          */
  /* ------------------------------------------------------------------ */
  function renderSectionTable(classItem, section) {
    const sectionMappings = getMappedSubjects(classItem.id);
    return (
      <div className="tt-section-card" key={`${classItem.id}-${section.id}`}>
        <div className="tt-section-heading">
          <div>
            <h3>
              {classItem.name} – Section {section.name}
            </h3>
            <span>
              {sectionMappings.reduce(
                (s, m) =>
                  s + placedCount(classItem.id, section.id, m.subjectId),
                0
              )}{" "}
              periods assigned
            </span>
          </div>
          <button
            type="button"
            className="tt-pdf-button"
            onClick={() => downloadSectionPdf(classItem, section)}
          >
            <Download size={15} /> Download PDF
          </button>
        </div>
        <div className="tt-table-wrap">
          <table className="tt-table tt-edit-table">
            <thead>
              <tr>
                <th>Day</th>
                {schedule.map((item) => (
                  <th
                    key={item.id}
                    className={item.type === "break" ? "tt-break-heading" : ""}
                  >
                    {item.name}
                    <small>{timeText(item)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day}>
                  <th>{day}</th>
                  {schedule.map((item) => {
                    if (item.type === "break")
                      return (
                        <td key={item.id} className="tt-break-cell">
                          {item.name}
                        </td>
                      );
                    const entry = getEntry(
                      day,
                      classItem.id,
                      section.id,
                      item.id
                    );
                    const mapped = getMappedSubjects(classItem.id);
                    const staleSubject =
                      entry?.subjectId &&
                      !mapped.some((m) => m.subjectId === entry.subjectId);
                    return (
                      <td
                        key={item.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) =>
                          handleDrop(
                            e,
                            day,
                            classItem.id,
                            section.id,
                            item.id
                          )
                        }
                      >
                        <div
                          className="tt-edit-cell"
                          draggable={!!entry}
                          onDragStart={(e) =>
                            handleDragStart(
                              e,
                              day,
                              classItem.id,
                              section.id,
                              item.id
                            )
                          }
                        >
                          {entry && (
                            <GripVertical
                              size={12}
                              className="tt-drag-handle"
                            />
                          )}
                          <select
                            aria-label={`${classItem.name} ${section.name} ${day} ${item.name} subject`}
                            value={entry?.subjectId || ""}
                            onChange={(e) =>
                              saveSlot(
                                day,
                                classItem.id,
                                section.id,
                                item.id,
                                e.target.value,
                                ""
                              )
                            }
                          >
                            <option value="">— Subject —</option>
                            {staleSubject && (
                              <option value={entry.subjectId}>
                                ⚠{" "}
                                {getName(
                                  subjects,
                                  entry.subjectId,
                                  "Unknown subject"
                                )}{" "}
                                (unmapped)
                              </option>
                            )}
                            {mapped.map((m) => (
                              <option key={m.subjectId} value={m.subjectId}>
                                {getName(subjects, m.subjectId)}
                              </option>
                            ))}
                          </select>
                          {entry?.subjectId &&
                            (() => {
                              const opts = getMappedTeacher(
                                classItem.id,
                                section.id,
                                entry.subjectId
                              ).options;
                              return opts.length > 1 ? (
                                <select
                                  aria-label="teacher"
                                  value={entry.teacherId || ""}
                                  onChange={(e) =>
                                    saveSlot(
                                      day,
                                      classItem.id,
                                      section.id,
                                      item.id,
                                      entry.subjectId,
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">
                                    — Select teacher —
                                  </option>
                                  {opts.map((o) => (
                                    <option
                                      key={o.teacher.id}
                                      value={o.teacher.id}
                                    >
                                      {o.teacher.name}
                                      {o.subjectCode
                                        ? ` (${o.subjectCode})`
                                        : ""}
                                      {o.periodsAllocated
                                        ? ` · ${o.periodsAllocated}/wk`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <small
                                  className={
                                    entry.teacherId
                                      ? "tt-teacher-name"
                                      : "tt-unassigned"
                                  }
                                >
                                  {entry.teacherId
                                    ? getName(teachers, entry.teacherId)
                                    : "Teacher not assigned / clash"}
                                </small>
                              );
                            })()}
                          {entry && (
                            <button
                              type="button"
                              className="tt-clear"
                              onClick={() => clearSlot(entry)}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tt-requirement-strip">
          {sectionMappings.map((m) => (
            <span key={m.subjectId}>
              {getName(subjects, m.subjectId)}:{" "}
              <b>
                {placedCount(classItem.id, section.id, m.subjectId)}/
                {Number(m.periodsPerWeek)}
              </b>
            </span>
          ))}
        </div>
      </div>
    );
  }

  function renderTeacherTables() {
    return teachers.map((teacher) => {
      const entries = timetable.filter(
        (e) => effectiveTeacherId(e) === teacher.id
      );
      return (
        <div className="tt-section-card" key={teacher.id}>
          <div className="tt-section-heading">
            <div>
              <h3>
                {teacher.name}
                {teacher.nickname ? ` (${teacher.nickname})` : ""}
              </h3>
              <span>{entries.length} assigned periods</span>
            </div>
            <button
              type="button"
              className="tt-pdf-button"
              onClick={() => downloadTeacherPdf(teacher)}
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
          <div className="tt-table-wrap">
            <table className="tt-table tt-compact">
              <thead>
                <tr>
                  <th>Day</th>
                  {schedule.map((item) => (
                    <th key={item.id}>
                      {item.name}
                      <small>{timeText(item)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <th>{day}</th>
                    {schedule.map((item) => {
                      if (item.type === "break")
                        return (
                          <td key={item.id} className="tt-break-cell">
                            {item.name}
                          </td>
                        );
                      const entry = entries.find(
                        (c) => c.day === day && c.periodId === item.id
                      );
                      return (
                        <td key={item.id}>
                          {entry ? (
                            <div className="tt-read-cell">
                              <b>{getName(subjects, entry.subjectId)}</b>
                              <span>
                                {getName(classes, entry.classId)} –{" "}
                                {getName(
                                  getSections(
                                    classes.find(
                                      (c) => c.id === entry.classId
                                    )
                                  ),
                                  entry.sectionId
                                )}
                              </span>
                              {getSubstitution(entry) && (
                                <small>Substitution</small>
                              )}
                            </div>
                          ) : (
                            <span className="tt-dash">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    });
  }

  function renderDayClasses() {
    const entries = getDayEntries(selectedDay);
    return (
      <>
        <div className="tt-toolbar">
          <label>
            Day
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="tt-table-wrap">
          <table className="tt-table tt-compact">
            <thead>
              <tr>
                <th>Class / Section</th>
                {schedule.map((i) => (
                  <th key={i.id}>
                    {i.name}
                    <small>{timeText(i)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.flatMap((c) =>
                getSections(c).map((sec) => (
                  <tr key={`${c.id}-${sec.id}`}>
                    <th>
                      {c.name}-{sec.name}
                    </th>
                    {schedule.map((period) => {
                      if (period.type === "break")
                        return (
                          <td key={period.id} className="tt-break-cell">
                            {period.name}
                          </td>
                        );
                      const entry = entries.find(
                        (e) =>
                          e.classId === c.id &&
                          e.sectionId === sec.id &&
                          e.periodId === period.id
                      );
                      return (
                        <td key={period.id}>
                          {entry ? (
                            <div className="tt-read-cell">
                              <b>{getName(subjects, entry.subjectId)}</b>
                              <span>
                                {getName(
                                  teachers,
                                  effectiveTeacherId(entry)
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="tt-dash">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderDayTeachers() {
    const entries = getDayEntries(selectedDay);
    return (
      <>
        <div className="tt-toolbar">
          <label>
            Day
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="tt-table-wrap">
          <table className="tt-table tt-compact">
            <thead>
              <tr>
                <th>Teacher</th>
                {schedule.map((i) => (
                  <th key={i.id}>
                    {i.name}
                    <small>{timeText(i)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <th>{teacher.name}</th>
                  {schedule.map((period) => {
                    if (period.type === "break")
                      return (
                        <td key={period.id} className="tt-break-cell">
                          {period.name}
                        </td>
                      );
                    const entry = entries.find(
                      (e) =>
                        effectiveTeacherId(e) === teacher.id &&
                        e.periodId === period.id
                    );
                    return (
                      <td key={period.id}>
                        {entry ? (
                          <div className="tt-read-cell">
                            <b>{getName(subjects, entry.subjectId)}</b>
                            <span>
                              {getName(classes, entry.classId)}-
                              {getName(
                                getSections(
                                  classes.find(
                                    (c) => c.id === entry.classId
                                  )
                                ),
                                entry.sectionId
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="tt-dash">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderSubstitutionView() {
    const absentRows = absentTeacherIds
      .map((id) => ({
        teacher: teachers.find((t) => t.id === id),
        entries: getDayEntries(subDay).filter((e) => e.teacherId === id),
      }))
      .filter((r) => r.teacher);

    return (
      <div className="tt-substitution-page">
        <div className="tt-sub-controls">
          <label>
            Day
            <select
              value={subDay}
              onChange={(e) => setSubDay(e.target.value)}
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="tt-absent-picker">
            <label>Absent teachers</label>
            <button
              type="button"
              className="tt-absent-toggle"
              onClick={() => setShowAbsentList((v) => !v)}
            >
              {absentTeacherIds.length
                ? `${absentTeacherIds.length} teacher(s) selected`
                : "Select absent teachers"}{" "}
              ▾
            </button>
            {showAbsentList && (
              <div className="tt-absent-list">
                <input
                  value={searchAbsent}
                  onChange={(e) => setSearchAbsent(e.target.value)}
                  placeholder="Search teachers"
                />
                {teachers
                  .filter((t) =>
                    `${t.name} ${t.nickname || ""}`
                      .toLowerCase()
                      .includes(searchAbsent.toLowerCase())
                  )
                  .map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={absentTeacherIds.includes(t.id)}
                        onChange={(e) =>
                          setAbsentTeacherIds((p) =>
                            e.target.checked
                              ? [...p, t.id]
                              : p.filter((id) => id !== t.id)
                          )
                        }
                      />
                      {t.name} {t.nickname ? `(${t.nickname})` : ""}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
        {!absentRows.length ? (
          <div className="tt-empty">
            Select the day and choose one or more absent teachers.
          </div>
        ) : (
          <>
            <div className="tt-table-wrap">
              <table className="tt-table tt-arrangement-table">
                <thead>
                  <tr>
                    <th>Absent teacher</th>
                    {schedule.map((i) => (
                      <th key={i.id}>
                        {i.name}
                        <small>{timeText(i)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {absentRows.map(({ teacher, entries }) => (
                    <tr key={teacher.id}>
                      <th>{teacher.name}</th>
                      {schedule.map((period) => {
                        if (period.type === "break")
                          return (
                            <td key={period.id} className="tt-break-cell">
                              {period.name}
                            </td>
                          );
                        const entry = entries.find(
                          (e) => e.periodId === period.id
                        );
                        if (!entry)
                          return (
                            <td key={period.id}>
                              <span className="tt-dash">Free / No class</span>
                            </td>
                          );
                        const currentSub = substitutions.find(
                          (s) =>
                            s.timetableEntryId === entry.id &&
                            s.day === subDay
                        );
                        const options = teachers
                          .filter(
                            (c) =>
                              isFreeForSubstitution(
                                c.id,
                                subDay,
                                period.id
                              ) ||
                              c.id === currentSub?.substituteTeacherId
                          )
                          .sort(
                            (a, b) =>
                              teacherFreePeriods(b.id, subDay) -
                              teacherFreePeriods(a.id, subDay)
                          );
                        return (
                          <td key={period.id}>
                            <div className="tt-arrangement-cell">
                              <b>
                                {getName(classes, entry.classId)}-
                                {getName(
                                  getSections(
                                    classes.find(
                                      (c) => c.id === entry.classId
                                    )
                                  ),
                                  entry.sectionId
                                )}
                              </b>
                              <span>
                                {getName(subjects, entry.subjectId)}
                              </span>
                              <select
                                value={
                                  currentSub?.substituteTeacherId || ""
                                }
                                onChange={(e) =>
                                  assignSubstitute(
                                    teacher.id,
                                    entry,
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">
                                  Select free teacher
                                </option>
                                {options.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} (
                                    {teacherFreePeriods(c.id, subDay)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tt-sub-summary">
              <b>Free-period availability for {subDay}</b>
              <div>
                {teachers
                  .filter((t) => !absentTeacherIds.includes(t.id))
                  .map((t) => (
                    <span key={t.id}>
                      {t.name}{" "}
                      <b>({teacherFreePeriods(t.id, subDay)})</b>
                    </span>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const tabs = [
    ["class", "Class-wise Timetable", School],
    ["teacher", "Teacher-wise Timetable", UserRound],
    ["dayClasses", "Day-wise All Classes", CalendarRange],
    ["dayTeachers", "Day-wise All Teachers", Users],
    ["substitution", "Substitution Arrangements", ArrowLeftRight],
    ["workload", "Teacher Workload", ListChecks],
  ];

  /* ------------------------------------------------------------------ */
  /* page                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="timetable-builder-page">
      <header className="tt-header">
        <div>
          <div className="tt-eyebrow">
            TIMETABLE WORKSPACE / BUILD &amp; REVIEW
          </div>
          <h1>Timetable Builder</h1>
          <p>
            {project?.data?.school?.schoolName ||
              project?.schoolName ||
              "School"}{" "}
            ·{" "}
            {project?.data?.school?.academicYear ||
              project?.academicYear ||
              ""}
          </p>
        </div>
        <div className="tt-header-actions">
          <span
            className={`tt-save-state ${
              saveStatus === "saving" ? "tt-saving" : ""
            }`}
          >
            {saveStatus === "saving" ? (
              <Clock size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {saveStatus === "saving" ? " Saving…" : saveStatus === "error" ? " Save failed" : " Auto-saved"}
          </span>
          <button
            className="tt-print"
            type="button"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Print current view
          </button>
        </div>
      </header>

      <div className="tt-summary">
        <div>
          <span>Classes / Sections</span>
          <strong>
            {classes.length} /{" "}
            {classes.reduce((s, c) => s + getSections(c).length, 0)}
          </strong>
        </div>
        <div>
          <span>Active teachers</span>
          <strong>{teachers.length}</strong>
        </div>
        <div>
          <span>Assigned periods</span>
          <strong>
            {assignedCount} / {totalSlots}
          </strong>
        </div>
        <div>
          <span>Teacher clashes</span>
          <strong className={clashGroups ? "tt-bad" : "tt-good"}>
            {clashGroups}
          </strong>
        </div>
      </div>

      {/* ============ AUTO-GENERATION CONFIG ============ */}
      <section className="tt-builder-config">
        <div className="tt-builder-config-head">
          <div>
            <h2>
              <Wand2
                size={16}
                style={{ verticalAlign: "middle", marginRight: 6 }}
              />
              Auto-generate Timetable
            </h2>
            <p>
              Builds every class-section timetable honouring weekly periods,
              teacher mappings and clash prevention. Any cell can still be
              edited afterwards.
            </p>
          </div>
        </div>

        <div className="tt-mode-switch">
          <button
            type="button"
            className={genMode === "empty" ? "active" : ""}
            onClick={() => setGenMode("empty")}
          >
            Fill Empty Slots
          </button>
          <button
            type="button"
            className={genMode === "full" ? "active" : ""}
            onClick={() => setGenMode("full")}
          >
            Regenerate All
          </button>
        </div>

        <div className="tt-config-grid">
          <label>
            Max same subject / day
            <input
              type="number"
              min="0"
              max="6"
              value={genConfig.maxPerDay}
              onChange={(e) =>
                setGenConfig({
                  ...genConfig,
                  maxPerDay: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className="tt-check-label">
            <input
              type="checkbox"
              checked={genConfig.avoidConsecutive}
              onChange={(e) =>
                setGenConfig({
                  ...genConfig,
                  avoidConsecutive: e.target.checked,
                })
              }
            />
            Avoid consecutive same subject
          </label>
          <label className="tt-check-label">
            <input
              type="checkbox"
              checked={genConfig.balanceWorkload}
              onChange={(e) =>
                setGenConfig({
                  ...genConfig,
                  balanceWorkload: e.target.checked,
                })
              }
            />
            Balance teacher workload
          </label>
        </div>

        {/* Fixed rules */}
        <div className="tt-fixed-config">
          <h3>
            <Pin
              size={14}
              style={{ verticalAlign: "middle", marginRight: 6 }}
            />
            Fixed Rules — pin a subject to a specific slot
          </h3>
          <p>
            Useful for lab periods, assembly-linked subjects or specific
            day+period rules. Fixed rules are placed before auto-generation.
          </p>

          <div className="tt-fixed-row">
            <select
              value={fixDraft.classId}
              onChange={(e) =>
                setFixDraft({
                  ...fixDraft,
                  classId: e.target.value,
                  sectionId: "",
                  subjectId: "",
                })
              }
            >
              <option value="">Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={fixDraft.sectionId}
              onChange={(e) =>
                setFixDraft({ ...fixDraft, sectionId: e.target.value })
              }
              disabled={!fixDraft.classId}
            >
              <option value="">Section</option>
              {fixSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={fixDraft.subjectId}
              onChange={(e) =>
                setFixDraft({ ...fixDraft, subjectId: e.target.value })
              }
              disabled={!fixDraft.classId}
            >
              <option value="">Subject</option>
              {fixSubjects.map((m) => (
                <option key={m.subjectId} value={m.subjectId}>
                  {getName(subjects, m.subjectId)}
                </option>
              ))}
            </select>
            <select
              value={fixDraft.day}
              onChange={(e) =>
                setFixDraft({ ...fixDraft, day: e.target.value })
              }
            >
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={fixDraft.periodId}
              onChange={(e) =>
                setFixDraft({ ...fixDraft, periodId: e.target.value })
              }
            >
              <option value="">Period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={addFixedRule}>
              + Add Rule
            </button>
          </div>

          {fixedRules.map((r) => {
            const sec = getSections(
              classes.find((c) => c.id === r.classId)
            ).find((s) => s.id === r.sectionId);
            const period = periods.find((p) => p.id === r.periodId);
            return (
              <div className="tt-fixed-rule" key={r.id}>
                <span>
                  <b>
                    {getName(classes, r.classId)}-{sec?.name || "?"}
                  </b>{" "}
                  · {getName(subjects, r.subjectId)} · {r.day} ·{" "}
                  {period?.name || "—"}
                </span>
                <button type="button" onClick={() => removeFixedRule(r.id)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <button
            type="button"
            className="tt-generate-button"
            onClick={autoGenerate}
            disabled={isGenerating}
          >
            <Wand2
              size={15}
              style={{ verticalAlign: "middle", marginRight: 5 }}
            />
            {isGenerating ? " Generating…" : " Generate Timetable"}
          </button>
          {timetable.length > 0 && (
            <button
              type="button"
              className="tt-clear-all-button"
              onClick={() => {
                if (window.confirm("Clear the entire timetable?")) {
                  setTimetable([]);
                  setSubstitutions([]);
                }
              }}
            >
              <RotateCcw size={14} />
              Clear Timetable
            </button>
          )}
        </div>
      </section>

      {notice && (
        <div className={`tt-notice tt-notice-${noticeKind}`} role="status">
          <AlertTriangle size={16} /> {notice}
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}

      {(!schedule.length ||
        !classes.length ||
        !subjects.length ||
        !teachers.length) && (
        <div className="tt-warning">
          <AlertTriangle size={17} /> Complete Bell Schedule, Classes,
          Subjects and Teachers before building the timetable.
        </div>
      )}

      <nav className="tt-tabs">
        {tabs.map(([id, title, Icon]) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={16} /> {title}
          </button>
        ))}
      </nav>

      <section className="tt-panel">
        {view === "class" &&
          (classes.length ? (
            classes.map((c) => (
              <div className="tt-class-group" key={c.id}>
                <h2>{c.name}</h2>
                {getSections(c).length ? (
                  getSections(c).map((sec) => renderSectionTable(c, sec))
                ) : (
                  <div className="tt-empty">
                    No active sections in {c.name}.
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="tt-empty">
              Add active classes and sections first.
            </div>
          ))}

        {view === "teacher" &&
          (teachers.length ? (
            renderTeacherTables()
          ) : (
            <div className="tt-empty">Add active teachers first.</div>
          ))}

        {view === "dayClasses" && renderDayClasses()}
        {view === "dayTeachers" && renderDayTeachers()}
        {view === "substitution" && renderSubstitutionView()}

        {view === "workload" && (
          <div>
            <h2 style={{ marginTop: 0 }}>Teacher Workload</h2>
            <div className="tt-table-wrap">
              <table className="tt-table tt-compact">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Periods/week</th>
                    <th>Classes</th>
                    <th>Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((row) => (
                    <tr key={row.teacher.id}>
                      <th>{row.teacher.name}</th>
                      <td>{row.periods}</td>
                      <td>{row.classes.size}</td>
                      <td>{row.subjects.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <p className="tt-footnote">
        Class-wise timetable is the master timetable. Teacher-wise, day-wise
        and workload views are generated from it. Substitution assignments are
        stored separately and do not overwrite regular teacher mappings.
      </p>
    </div>
  );
}