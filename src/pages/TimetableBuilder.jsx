import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Download, Printer,
  School, Users, UserRound, CalendarRange, ArrowLeftRight,
  Wand2, GripVertical, ListChecks, RotateCcw, Clock, Pin, Trash2,
  FileSpreadsheet, Undo2, Redo2,
} from "lucide-react";
import { solveTimetableAsync } from "../lib/timetableSolver";
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
const safeFilename = (v) =>
  String(v ?? "")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Untitled";
const saveXlsxBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const ABSENCE_REASONS = [
  "Sick Leave", "Casual Leave", "Earned Leave",
  "Training / Workshop", "Official Duty", "Personal Reason", "Other",
];

function normalizeSubstitutionRecord(s) {
  if (!s || typeof s !== "object") return null;
  const reasonCategory =
    s.reasonCategory ||
    (s.reason === "Absent teacher" || !s.reason ? "Other" : s.reason);
  return {
    ...s,
    id: String(s.id || makeId()),
    date: s.date || "",
    day: s.day || "",
    periodId: s.periodId || "",
    timetableEntryId: s.timetableEntryId || "",
    classId: s.classId || "",
    sectionId: s.sectionId || "",
    subjectId: s.subjectId || "",
    originalTeacherId: s.originalTeacherId || "",
    substituteTeacherId: s.substituteTeacherId || "",
    reasonCategory: ABSENCE_REASONS.includes(reasonCategory) ? reasonCategory : "Other",
    reasonNote: String(s.reasonNote || ""),
    verifiedStatus: ["pending", "covered", "not-covered"].includes(s.verifiedStatus)
      ? s.verifiedStatus : "pending",
    verifiedAt: s.verifiedAt || null,
    createdAt: s.createdAt || new Date().toISOString(),
  };
}

function normalizeAbsence(a) {
  if (!a || typeof a !== "object") return null;
  return {
    id: String(a.id || makeId()),
    date: a.date || "",
    day: a.day || "",
    teacherId: a.teacherId || "",
    reasonCategory: ABSENCE_REASONS.includes(a.reasonCategory)
      ? a.reasonCategory
      : "Other",
    reasonNote: String(a.reasonNote || ""),
    verifiedStatus: ["pending", "covered", "not-covered"].includes(a.verifiedStatus)
      ? a.verifiedStatus
      : "pending",
    verifiedAt: a.verifiedAt || null,
    createdAt: a.createdAt || new Date().toISOString(),
  };
}

function deriveWeekday(dateStr, availableDays) {
  if (!dateStr) return availableDays[0] || "Monday";
  const dow = new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });
  return availableDays.includes(dow) ? dow : availableDays[0] || "Monday";
}

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
    
@page {
  size: A4 landscape;
  margin: 18mm 12mm 12mm 12mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, sans-serif;
  color: #111;
  max-width: 273mm;
  margin: 0 auto;
}

/* School heading */
h2 {
  text-align: center;
  font-size: 16px;
  margin: 0 0 5px;
  padding-top: 3mm;
  line-height: 1.4;
}

/* Class and section heading */
h3 {
  text-align: center;
  font-size: 13px;
  margin: 0 0 10px;
  font-weight: 600;
}

/* Academic year */
.meta {
  text-align: center;
  font-size: 10px;
  margin-bottom: 12px;
}

/* Timetable centered on the page */
table {
  width: 96%;
  max-width: 263mm;
  margin: 8mm auto 0;
  border-collapse: collapse;
  table-layout: fixed;
}

/* Table cells */
th,
td {
  border: 1px solid #333;
  padding: 6px 4px;
  text-align: center;
  vertical-align: middle;
  font-size: 9px;
  overflow-wrap: anywhere;
}

/* Header */
th {
  background: #eef2f7;
  font-weight: 700;
}

/* Day column */
td:first-child,
th:first-child {
  width: 12%;
}

/* Break and lunch */
.break {
  background: #f1f1f1;
  font-weight: 700;
}

/* Print behavior */
@media print {
  html,
  body {
    margin: 0 auto;
  }

  table {
    margin: 8mm auto 0;
    width: 96%;
  }

  tr {
    break-inside: avoid;
  }

  thead {
    display: table-header-group;
  }
}

  </style></head><body>
    <h2>${escapeHtml(schoolName || "School")}</h2>
    <h3>${escapeHtml(title)}</h3>
    <div class="meta">Academic Year: ${escapeHtml(academicYear || "")}</div>
        <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>setTimeout(function(){try{window.focus();window.print();}catch(e){}}, 120);</script>
    </body></html>`;
}

function buildMultiBlockPrintableHtml({
  title,
  schoolName,
  academicYear,
  blocks,
}) {
  const blocksHtml = blocks
    .map(
      (block, idx) => `
    <div class="block${idx < blocks.length - 1 ? " block-break" : ""}">
      <h3>${escapeHtml(block.heading)}</h3>
      <table>
        <thead><tr>${block.headers
          .map((h) => `<th>${cellToHtml(h)}</th>`)
          .join("")}</tr></thead>
        <tbody>${block.rows
          .map(
            (row) =>
              `<tr>${row.map((c) => `<td>${cellToHtml(c)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody>
      </table>
    </div>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title>
  <style>
    @page { size: A4 landscape; margin: 18mm 12mm 12mm 12mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #111; max-width: 273mm; margin: 0 auto; }
    h2 { text-align: center; font-size: 16px; margin: 0 0 5px; padding-top: 3mm; line-height: 1.4; }
    h3 { text-align: center; font-size: 13px; margin: 14px 0 6px; font-weight: 600; }
    .meta { text-align: center; font-size: 10px; margin-bottom: 12px; }
    table { width: 96%; max-width: 263mm; margin: 4mm auto 8mm; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #333; padding: 6px 4px; text-align: center; vertical-align: middle; font-size: 9px; overflow-wrap: anywhere; }
    th { background: #eef2f7; font-weight: 700; }
    td:first-child, th:first-child { width: 15%; }
    .block-break { break-after: page; page-break-after: always; }
    @media print {
      tr { break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style></head><body>
    <h2>${escapeHtml(schoolName || "School")}</h2>
    <h3>${escapeHtml(title)}</h3>
    <div class="meta">Academic Year: ${escapeHtml(academicYear || "")}</div>
    ${blocksHtml}
    <script>setTimeout(function(){try{window.focus();window.print();}catch(e){}}, 120);</script>
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
  onSaveAbsences,
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
  const optionSets = useMemo(
    () => safeArray(project?.data?.optionSets),
    [project?.data?.optionSets]
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
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
    const [substitutions, setSubstitutions] = useState(() =>
    safeArray(project?.data?.substitutions)
      .map(normalizeSubstitutionRecord)
      .filter(Boolean)
  );
  const [absences, setAbsences] = useState(() =>
    safeArray(project?.data?.absences).map(normalizeAbsence).filter(Boolean)
  );
    const getTodayLocal = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const [substitutionDate, setSubstitutionDate] = useState(getTodayLocal);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyReasonFilter, setHistoryReasonFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("info");
  const [saveStatus, setSaveStatus] = useState("saved");
    const [selectedDay, setSelectedDay] = useState(days[0] || "Monday");
      const subDay = useMemo(
    () => deriveWeekday(substitutionDate, days),
    [substitutionDate, days]
  );
  const absentTeacherIds = useMemo(
    () =>
      absences
        .filter((a) => a.date === substitutionDate)
        .map((a) => a.teacherId),
    [absences, substitutionDate]
  );
  const [searchAbsent, setSearchAbsent] = useState("");
  const [showAbsentList, setShowAbsentList] = useState(false);

  const savedSettings = safeObject(project?.data?.timetableSettings);
  const [genMode, setGenMode] = useState(() => savedSettings.genMode || "empty");
    const [genConfig, setGenConfig] = useState(() => ({
    maxPerDay: savedSettings.genConfig?.maxPerDay ?? 2,
    avoidConsecutive: savedSettings.genConfig?.avoidConsecutive ?? true,
    balanceWorkload: savedSettings.genConfig?.balanceWorkload ?? true,
    maxTeacherPeriodsPerDay: savedSettings.genConfig?.maxTeacherPeriodsPerDay ?? 6,
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
  const saveAbsencesRef = useRef(onSaveAbsences);
  const saveSettingsRef = useRef(onSaveTimetableSettings);

  // Always-current value refs (used by the unmount flush).
  const timetableRef = useRef(timetable);
  timetableRef.current = timetable;
  const substitutionsRef = useRef(substitutions);
  substitutionsRef.current = substitutions;
    const absencesRef = useRef(absences);
  absencesRef.current = absences;
  const settingsRef = useRef({ genMode, genConfig, fixedRules });
  settingsRef.current = { genMode, genConfig, fixedRules };

  useEffect(() => { saveTimetableRef.current = onSaveTimetable; }, [onSaveTimetable]);
  useEffect(() => { saveSubstitutionsRef.current = onSaveSubstitutions; }, [onSaveSubstitutions]);
    useEffect(() => { saveAbsencesRef.current = onSaveAbsences; }, [onSaveAbsences]);
  useEffect(() => { saveSettingsRef.current = onSaveTimetableSettings; }, [onSaveTimetableSettings]);

  /* Reload project data on project switch. Skip on the initial mount since
     useState already used the same data. */
  const isFirstMount = useRef(true);
    // Save the current timetable to the undo stack before a change
  const saveHistory = () => {
    setUndoStack((prev) => {
      const next = [...prev, timetable];
      if (next.length > 50) return next.slice(1); // Max 50 steps
      return next;
    });
    setRedoStack([]); // Clear redo on new action
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [timetable, ...prev]);
    setTimetable(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    setNotice("Undo successful.");
    setNoticeKind("info");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack((prev) => [...prev, timetable]);
    setTimetable(next);
    setRedoStack((prev) => prev.slice(1));
    setNotice("Redo successful.");
    setNoticeKind("info");
  };
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
            setTimetable(safeArray(project?.data?.timetable));
    setSubstitutions(safeArray(project?.data?.substitutions));
    setAbsences(
      safeArray(project?.data?.absences).map(normalizeAbsence).filter(Boolean)
    );
    setSubstitutionDate(new Date().toISOString().slice(0, 10));
    setHistorySearch("");
    setHistoryStatusFilter("all");
    setHistoryReasonFilter("all");
    setShowAbsentList(false);
    setSearchAbsent("");
    const d = getDays(project);
    setSelectedDay(d[0] || "Monday");
    const s = safeObject(project?.data?.timetableSettings);
    setGenMode(s.genMode || "empty");
        setGenConfig({
      maxPerDay: s.genConfig?.maxPerDay ?? 2,
      avoidConsecutive: s.genConfig?.avoidConsecutive ?? true,
      balanceWorkload: s.genConfig?.balanceWorkload ?? true,
      maxTeacherPeriodsPerDay: s.genConfig?.maxTeacherPeriodsPerDay ?? 6,
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
    setUndoStack([]);
    setRedoStack([]);
  }, [projectId]);

    /* Global keyboard shortcuts for undo/redo */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input/select
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack, redoStack, timetable]); // dependencies ensure the closures have latest state

  /* Unmount flush — guarantees that quick navigation never loses work. */
  
  useEffect(() => {
    return () => {
            saveTimetableRef.current?.(timetableRef.current);
      saveSubstitutionsRef.current?.(substitutionsRef.current);
      saveAbsencesRef.current?.(absencesRef.current);
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
    /* Auto-save absences (skip first render). */
  const skipNextAbsenceSave = useRef(true);
  useEffect(() => {
    if (skipNextAbsenceSave.current) {
      skipNextAbsenceSave.current = false;
      return;
    }
    const t = setTimeout(
      () => saveAbsencesRef.current?.(absences),
      450
    );
    return () => clearTimeout(t);
  }, [absences]);

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
    substitutions
      .filter((s) => s.date === substitutionDate)
      .forEach((s) => m.set(s.timetableEntryId, s));
    return m;
  }, [substitutions, substitutionDate]);

    const getEntry = (day, classId, sectionId, periodId) =>
    entryMap.get(slotKey(day, classId, sectionId, periodId));

  const getAllEntriesAt = (day, classId, sectionId, periodId) =>
    timetable.filter(
      (e) =>
        e.day === day &&
        e.classId === classId &&
        e.sectionId === sectionId &&
        e.periodId === periodId
    );

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
  /* ------------------------------------------------------------------ */
  /* day-wise absence helpers                                           */
  /* ------------------------------------------------------------------ */
  function findAbsence(date, teacherId) {
    return absences.find(
      (a) => a.date === date && a.teacherId === teacherId
    );
  }

  function upsertAbsence(patch) {
    setAbsences((prev) => {
      const idx = prev.findIndex(
        (a) => a.date === patch.date && a.teacherId === patch.teacherId
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          id: makeId(),
          verifiedStatus: "pending",
          verifiedAt: null,
          createdAt: new Date().toISOString(),
          ...patch,
        },
      ];
    });
  }

  function removeAbsenceIfSafe(date, teacherId) {
    const a = findAbsence(date, teacherId);
    if (!a) return;
    // Only drop the record if the user hasn't touched it and no periods
    // were assigned a substitute — otherwise it's an audit entry.
    if (a.verifiedStatus !== "pending") return;
    if (String(a.reasonNote || "").trim()) return;
    const hasSubs = substitutions.some(
      (s) => s.originalTeacherId === teacherId && s.day === subDay
    );
    if (hasSubs) return;
    setAbsences((prev) => prev.filter((x) => x.id !== a.id));
  }

  function toggleAbsentTeacher(teacherId, checked) {
    if (checked) {
      if (!findAbsence(substitutionDate, teacherId)) {
        upsertAbsence({
          date: substitutionDate,
          day: subDay,
          teacherId,
          reasonCategory: "Sick Leave",
          reasonNote: "",
        });
      }
    } else {
      removeAbsenceIfSafe(substitutionDate, teacherId);
    }
  }
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
    const all = getAllEntriesAt(day, classId, sectionId, periodId);
    if (all.length > 1) {
      flash(
        "warn",
        "This slot holds a parallel group. Clear it first to reassign."
      );
      return;
    }
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
    saveHistory(); // <--- ADD HERE

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

    // Mark manually-entered or edited periods as locked so the generator
// preserves them during regeneration. Clearing the cell removes the lock.
const record = {
  id: existing?.id || makeId(),
  day,
  classId,
  sectionId,
  periodId,
  subjectId,
  teacherId,
  fixed: true,
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
    saveHistory(); // <--- ADD HERE
    setTimetable((p) => p.filter((e) => e.id !== entry.id));
    setSubstitutions((p) =>
      p.filter((s) => s.timetableEntryId !== entry.id)
    );
    flash("info", "Period cleared.");
  }

    function clearCellAt(day, classId, sectionId, periodId) {
    const toRemove = getAllEntriesAt(day, classId, sectionId, periodId);
    if (!toRemove.length) return;
    saveHistory(); // <--- ADD HERE
    const ids = new Set(toRemove.map((e) => e.id));
    setTimetable((prev) => prev.filter((e) => !ids.has(e.id)));
    setSubstitutions((prev) =>
      prev.filter((s) => !ids.has(s.timetableEntryId))
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

        saveHistory(); // <--- ADD HERE
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
  fixed: true,
  updatedAt: new Date().toISOString(),
});
if (dstEntry) {
  next.push({
    ...dstEntry,
    day: src.day,
    classId: src.classId,
    sectionId: src.sectionId,
    periodId: src.periodId,
    fixed: true,
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
  async function autoGenerate() {
    setIsGenerating(true);
    try {
      // FIX: Declare the missing variable so the app doesn't crash
      const existingBeforeSolveIds = new Set(timetable.map((e) => e.id));

      const result = await solveTimetableAsync({
        classes,
        subjects,
        teachers,
        subjectMappings,
        teacherMappings,
        optionSets, // <--- ADD THIS LINE
        periods,
        days,
        existingTimetable: timetable,
        substitutions,
        fixedRules,
        config: genConfig,
        mode: genMode,
      });

            if (!result.ok) {
        flash("error", result.message);
        return;
      }

      saveHistory(); // <--- ADD HERE
      setTimetable(result.timetable);

            // Substitutions are audit records — never deleted on regeneration.
      // Stale records (timetableEntryId no longer present) are simply
      // ignored by the date-scoped substitutionMap above.

            const lockedPreserved =
  genMode === "full"
    ? timetable.filter((e) => e.fixed === true).length
    : 0;

const preservedCount =
  result.timetable.filter((e) => e.fixed === true).length +
  (genMode === "empty"
    ? result.timetable.filter((e) => !e.fixed && existingBeforeSolveIds.has(e.id)).length
    : 0);
const newlyGenerated = Math.max(0, result.newEntriesCount - preservedCount);

let msg = `Timetable generated: ${result.newEntriesCount} period${
  result.newEntriesCount === 1 ? "" : "s"
} total${
  preservedCount > 0
    ? ` (${newlyGenerated} new, ${preservedCount} preserved)`
    : ""
}.`;

      if (result.unplacedCount) {
        // Build a detailed list of exactly what failed
        const failures = result.unplacedGroups.map((group) => {
          const className = classes.find((c) => c.id === group.classId)?.name || "Unknown";
          const sectionName = getSections(classes.find((c) => c.id === group.classId)).find((s) => s.id === group.sectionId)?.name || "Unknown";
          const subjectName = subjects.find((s) => s.id === group.subjectId)?.name || "Unknown";
          return `Class ${className}-${sectionName} (${subjectName}: ${group.remaining} left)`;
        });

        const uniqueFailures = [...new Set(failures)];
        
        msg += ` ${result.unplacedCount} subject-section(s) could not be fully placed.`;
        
        // Show the detailed failures as a red error banner (so it doesn't disappear too quickly)
        flash(
          "error",
          `Could not place: ${uniqueFailures.join(", ")}. Check teacher mappings or increase available slots.`
        );
      } else {
        flash("success", msg);
      }
    } catch (err) {
      console.error("Timetable generation failed:", err);
      flash("error", "Timetable generation failed. Check the browser console.");
    } finally {
      setIsGenerating(false);
    }
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
                const cellEntries = getAllEntriesAt(day, classItem.id, section.id, item.id);
        if (!cellEntries.length) return "—";
        
        return cellEntries.map((entry) => {
          const code =
            getMappedTeacher(classItem.id, section.id, entry.subjectId).options.find(
              (o) => o.teacher.id === entry.teacherId
            )?.subjectCode || "";
          const subject = getName(subjects, entry.subjectId);
          const teacher = entry.teacherId ? getName(teachers, entry.teacherId) : "Teacher not assigned";
          return `${subject}${code ? ` (${code})` : ""}\n${teacher}`;
        }).join("\n---\n");
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
  /* Excel exports                                                      */
  /* ------------------------------------------------------------------ */
  function writeSectionBlock(sheet, startRow, classItem, section) {
    const schoolName =
      project?.data?.school?.schoolName || project?.schoolName || "School";
    const academicYear =
      project?.data?.school?.academicYear || project?.academicYear || "";
    const totalCols = schedule.length + 1;

    // Row 1: school name (merged, bold, centred)
    sheet.mergeCells(startRow, 1, startRow, totalCols);
    const titleCell = sheet.getCell(startRow, 1);
    titleCell.value = schoolName;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(startRow).height = 28;

    // Row 2: class-section title
    sheet.mergeCells(startRow + 1, 1, startRow + 1, totalCols);
    const subCell = sheet.getCell(startRow + 1, 1);
    subCell.value = `Class ${classItem.name} – Section ${section.name} Timetable`;
    subCell.font = { bold: true, size: 12 };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(startRow + 1).height = 22;

    // Row 3: academic year
    sheet.mergeCells(startRow + 2, 1, startRow + 2, totalCols);
    const yearCell = sheet.getCell(startRow + 2, 1);
    yearCell.value = `Academic Year: ${academicYear}`;
    yearCell.alignment = { horizontal: "center" };
    sheet.getRow(startRow + 2).height = 18;

    // Row 4 stays blank as a visual gap.

    // Row 5: header
    const headerRowNumber = startRow + 4;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = [
      "Day",
      ...schedule.map((i) =>
        timeText(i) ? `${i.name}\n(${timeText(i)})` : i.name
      ),
    ];
    headerRow.font = { bold: true, size: 11 };
    headerRow.height = 38;
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    for (let col = 1; col <= totalCols; col += 1) {
      const cell = sheet.getCell(headerRowNumber, col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5EAF2" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    // Rows 6..N: one row per day
    days.forEach((day, dayIdx) => {
      const rowNumber = startRow + 5 + dayIdx;
      const row = sheet.getRow(rowNumber);
      row.values = [
        day,
        ...schedule.map((item) => {
          if (item.type === "break") return item.name;
                    const cellEntries = getAllEntriesAt(day, classItem.id, section.id, item.id);
          if (!cellEntries.length) return "—";
          
          return cellEntries.map((entry) => {
            const code =
              getMappedTeacher(classItem.id, section.id, entry.subjectId)
                .options.find((o) => o.teacher.id === entry.teacherId)
                ?.subjectCode || "";
            const subject = getName(subjects, entry.subjectId);
            const teacher = entry.teacherId
              ? getName(teachers, entry.teacherId)
              : "Teacher not assigned";
            return `${subject}${code ? ` (${code})` : ""}\n${teacher}`;
          }).join("\n---\n");
        }),
      ];
      row.height = 48;
      row.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      for (let col = 1; col <= totalCols; col += 1) {
        const cell = sheet.getCell(rowNumber, col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (col === 1) {
          cell.font = { bold: true, size: 11 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7F9FC" },
          };
        } else {
          const item = schedule[col - 2];
          if (item?.type === "break") {
            cell.font = { bold: true, color: { argb: "FF80520B" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF8E8" },
            };
          }
        }
      }
    });

    // Return the first row after this block so the caller can offset the next one.
    return startRow + 5 + days.length;
  }

  function writeTeacherBlock(sheet, startRow, teacher) {
    const schoolName =
      project?.data?.school?.schoolName || project?.schoolName || "School";
    const academicYear =
      project?.data?.school?.academicYear || project?.academicYear || "";
    const totalCols = schedule.length + 1;

    sheet.mergeCells(startRow, 1, startRow, totalCols);
    const titleCell = sheet.getCell(startRow, 1);
    titleCell.value = schoolName;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(startRow).height = 28;

    sheet.mergeCells(startRow + 1, 1, startRow + 1, totalCols);
    const subCell = sheet.getCell(startRow + 1, 1);
    subCell.value = `Teacher Timetable – ${teacher.name}${
      teacher.nickname ? ` (${teacher.nickname})` : ""
    }`;
    subCell.font = { bold: true, size: 12 };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(startRow + 1).height = 22;

    sheet.mergeCells(startRow + 2, 1, startRow + 2, totalCols);
    sheet.getCell(startRow + 2, 1).value = `Academic Year: ${academicYear}`;
    sheet.getCell(startRow + 2, 1).alignment = { horizontal: "center" };
    sheet.getRow(startRow + 2).height = 18;

    const headerRowNumber = startRow + 4;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = [
      "Day",
      ...schedule.map((i) =>
        timeText(i) ? `${i.name}\n(${timeText(i)})` : i.name
      ),
    ];
    headerRow.font = { bold: true, size: 11 };
    headerRow.height = 38;
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    for (let col = 1; col <= totalCols; col += 1) {
      const cell = sheet.getCell(headerRowNumber, col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5EAF2" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    const entries = timetable.filter(
      (e) => effectiveTeacherId(e) === teacher.id
    );

    days.forEach((day, dayIdx) => {
      const rowNumber = startRow + 5 + dayIdx;
      const row = sheet.getRow(rowNumber);
      row.values = [
        day,
        ...schedule.map((item) => {
          if (item.type === "break") return item.name;
          const entry = entries.find(
            (e) => e.day === day && e.periodId === item.id
          );
          if (!entry) return "—";
          const cls = getName(classes, entry.classId);
          const sec = getName(
            getSections(classes.find((c) => c.id === entry.classId)),
            entry.sectionId
          );
          return `${getName(subjects, entry.subjectId)}\n${cls} - ${sec}`;
        }),
      ];
      row.height = 44;
      row.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      for (let col = 1; col <= totalCols; col += 1) {
        const cell = sheet.getCell(rowNumber, col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (col === 1) {
          cell.font = { bold: true, size: 11 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7F9FC" },
          };
        } else {
          const item = schedule[col - 2];
          if (item?.type === "break") {
            cell.font = { bold: true, color: { argb: "FF80520B" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF8E8" },
            };
          }
        }
      }
    });

    return startRow + 5 + days.length;
  }

  function applyScheduleColumnWidths(sheet, wideColumnWidth) {
    sheet.getColumn(1).width = 13;
    schedule.forEach((item, i) => {
      sheet.getColumn(i + 2).width =
        item.type === "break" ? 11 : wideColumnWidth;
    });
  }

  async function exportSectionExcel(classItem, section) {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "KV Timetable Builder";
      workbook.created = new Date();
      let baseName = `Class ${classItem.name} ${section.name}`
        .slice(0, 31)
        .replace(/[\[\]\*\?\/\\:]/g, "_");
      if (!baseName) baseName = "Section";
      const sheet = workbook.addWorksheet(baseName, {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });
      writeSectionBlock(sheet, 1, classItem, section);
      applyScheduleColumnWidths(sheet, 24);
      const buffer = await workbook.xlsx.writeBuffer();
      saveXlsxBuffer(
        buffer,
        `Class_${safeFilename(classItem.name)}_Section_${safeFilename(
          section.name
        )}_Timetable.xlsx`
      );
      flash("success", "Excel file downloaded.");
    } catch (err) {
      console.error("Excel export failed:", err);
      flash("error", "Excel export failed. Check the browser console.");
    }
  }

  async function exportTeacherExcel(teacher) {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "KV Timetable Builder";
      workbook.created = new Date();
      let baseName = (teacher.name || "Teacher")
        .slice(0, 31)
        .replace(/[\[\]\*\?\/\\:]/g, "_");
      if (!baseName) baseName = "Teacher";
      const sheet = workbook.addWorksheet(baseName, {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });
      writeTeacherBlock(sheet, 1, teacher);
      applyScheduleColumnWidths(sheet, 22);
      const buffer = await workbook.xlsx.writeBuffer();
      saveXlsxBuffer(
        buffer,
        `Teacher_${safeFilename(teacher.name)}_Timetable.xlsx`
      );
      flash("success", "Excel file downloaded.");
    } catch (err) {
      console.error("Excel export failed:", err);
      flash("error", "Excel export failed. Check the browser console.");
    }
  }

  async function exportAllSectionsExcel() {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    const pairs = [];
    classes.forEach((c) => {
      getSections(c).forEach((sec) => {
        pairs.push({ classItem: c, section: sec });
      });
    });
    if (!pairs.length) {
      flash("warn", "No class-sections available to export.");
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "KV Timetable Builder";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("All Class-Sections", {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      // Stack every section block vertically with two blank rows between them.
      let currentRow = 1;
      pairs.forEach(({ classItem, section }, idx) => {
        currentRow = writeSectionBlock(
          sheet,
          currentRow,
          classItem,
          section
        );
        if (idx < pairs.length - 1) currentRow += 2;
      });
      applyScheduleColumnWidths(sheet, 24);

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      const schoolTag = safeFilename(
        project?.data?.school?.schoolName || project?.schoolName || "School"
      );
      saveXlsxBuffer(
        buffer,
        `All_Class_Sections_${schoolTag}_${stamp}.xlsx`
      );
      flash(
        "success",
        `Exported ${pairs.length} class-section(s) in a single sheet.`
      );
    } catch (err) {
      console.error("Excel export failed:", err);
      flash("error", "Excel export failed. Check the browser console.");
    }
  }

  async function exportAllTeachersExcel() {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    if (!teachers.length) {
      flash("warn", "No teachers available to export.");
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "KV Timetable Builder";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("All Teachers", {
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      // Stack every teacher block vertically with two blank rows between them.
      let currentRow = 1;
      teachers.forEach((teacher, idx) => {
        currentRow = writeTeacherBlock(sheet, currentRow, teacher);
        if (idx < teachers.length - 1) currentRow += 2;
      });
      applyScheduleColumnWidths(sheet, 22);

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      const schoolTag = safeFilename(
        project?.data?.school?.schoolName || project?.schoolName || "School"
      );
      saveXlsxBuffer(
        buffer,
        `All_Teachers_${schoolTag}_${stamp}.xlsx`
      );
      flash(
        "success",
        `Exported ${teachers.length} teacher(s) in a single sheet.`
      );
    } catch (err) {
      console.error("Excel export failed:", err);
      flash("error", "Excel export failed. Check the browser console.");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Day-wise & substitution exports                                    */
  /* ------------------------------------------------------------------ */
  function buildDayBlocksForClasses() {
    return days.map((day) => ({
      heading: day,
      headers: [
        "Class / Section",
        ...schedule.map((i) =>
          timeText(i) ? `${i.name}\n(${timeText(i)})` : i.name
        ),
      ],
      rows: classes.flatMap((c) =>
        getSections(c).map((sec) => [
          `${c.name}-${sec.name}`,
          ...schedule.map((period) => {
            if (period.type === "break") return period.name;
                        const cellEntries = timetable.filter(
              (e) =>
                e.day === day &&
                e.classId === c.id &&
                e.sectionId === sec.id &&
                e.periodId === period.id
            );
            if (!cellEntries.length) return "—";
            return cellEntries.map(entry => 
              `${getName(subjects, entry.subjectId)}\n${getName(
                teachers,
                effectiveTeacherId(entry)
              )}`
            ).join("\n---\n");
          }),
        ])
      ),
    }));
  }

  function buildDayBlocksForTeachers() {
    return days.map((day) => ({
      heading: day,
      headers: [
        "Teacher",
        ...schedule.map((i) =>
          timeText(i) ? `${i.name}\n(${timeText(i)})` : i.name
        ),
      ],
      rows: teachers.map((teacher) => [
        teacher.nickname ? `${teacher.name} (${teacher.nickname})` : teacher.name,
        ...schedule.map((period) => {
          if (period.type === "break") return period.name;
          const entry = timetable.find(
            (e) =>
              e.day === day &&
              effectiveTeacherId(e) === teacher.id &&
              e.periodId === period.id
          );
          if (!entry) return "—";
          const cls = getName(classes, entry.classId);
          const sec = getName(
            getSections(classes.find((c) => c.id === entry.classId)),
            entry.sectionId
          );
          return `${getName(subjects, entry.subjectId)}\n${cls}-${sec}`;
        }),
      ]),
    }));
  }

  function buildDayBlocksForSubstitution() {
    // Only the day currently selected in the Substitution view.
    const day = subDay;
    if (!day) return [];

    const absentRows = absentTeacherIds
      .map((id) => ({
        teacher: teachers.find((t) => t.id === id),
        entries: timetable.filter((e) => e.day === day && e.teacherId === id),
      }))
      .filter((r) => r.teacher);

    if (!absentRows.length) return [];

    return [
      {
                heading: `${day} — ${substitutionDate}`,
        headers: [
          "Absent teacher",
          ...schedule.map((i) =>
            timeText(i) ? `${i.name}\n(${timeText(i)})` : i.name
          ),
        ],
        rows: absentRows.map(({ teacher, entries }) => [
          teacher.nickname
            ? `${teacher.name} (${teacher.nickname})`
            : teacher.name,
          ...schedule.map((period) => {
            if (period.type === "break") return period.name;
            const entry = entries.find((e) => e.periodId === period.id);
            if (!entry) return "Free / No class";
                        const currentSub = substitutions.find(
                          (s) =>
                            s.timetableEntryId === entry.id &&
                            s.date === substitutionDate
                        );
            const classSec = `${getName(
              classes,
              entry.classId
            )}-${getName(
              getSections(classes.find((c) => c.id === entry.classId)),
              entry.sectionId
            )}`;
            const subject = getName(subjects, entry.subjectId);
                        const subName = currentSub
              ? getName(teachers, currentSub.substituteTeacherId)
              : "Not assigned";
            const reason = currentSub?.reasonCategory || "";
            const status = currentSub?.verifiedStatus || "";
            return `${classSec}\n${subject}\n→ ${subName}` +
              (reason ? `\n[${reason}]` : "") +
              (status ? ` · ${status}` : "");
          }),
        ]),
      },
    ];
  }

  function writeDayBlock(sheet, startRow, blockData) {
    const totalCols = schedule.length + 1;

    // Day heading strip (merged)
    sheet.mergeCells(startRow, 1, startRow, totalCols);
    const headingCell = sheet.getCell(startRow, 1);
    headingCell.value = blockData.heading;
    headingCell.font = { bold: true, size: 14 };
    headingCell.alignment = { horizontal: "center", vertical: "middle" };
    headingCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDDE7F5" },
    };
    headingCell.border = {
      top: { style: "medium" },
      left: { style: "medium" },
      bottom: { style: "medium" },
      right: { style: "medium" },
    };
    sheet.getRow(startRow).height = 26;

    // Column headers
    const headerRowNumber = startRow + 1;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = blockData.headers;
    headerRow.font = { bold: true, size: 11 };
    headerRow.height = 38;
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    for (let col = 1; col <= totalCols; col += 1) {
      const cell = sheet.getCell(headerRowNumber, col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5EAF2" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    // Data rows
    blockData.rows.forEach((values, idx) => {
      const rowNumber = startRow + 2 + idx;
      const row = sheet.getRow(rowNumber);
      row.values = values;
      row.height = 48;
      row.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      for (let col = 1; col <= totalCols; col += 1) {
        const cell = sheet.getCell(rowNumber, col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (col === 1) {
          cell.font = { bold: true, size: 11 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7F9FC" },
          };
        } else {
          const item = schedule[col - 2];
          if (item?.type === "break") {
            cell.font = { bold: true, color: { argb: "FF80520B" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF8E8" },
            };
          }
        }
      }
    });

    return startRow + 2 + blockData.rows.length;
  }

  async function exportDaywiseExcel(blocks, filenamePrefix) {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    if (!blocks.length) {
      flash("warn", "Nothing to export.");
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "KV Timetable Builder";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet(
        filenamePrefix.replace(/_/g, " ").slice(0, 31),
        {
          pageSetup: {
            paperSize: 9,
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
          },
        }
      );

      let currentRow = 1;
      blocks.forEach((block, idx) => {
        currentRow = writeDayBlock(sheet, currentRow, block);
        if (idx < blocks.length - 1) currentRow += 2;
      });
      applyScheduleColumnWidths(sheet, 24);

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      const schoolTag = safeFilename(
        project?.data?.school?.schoolName || project?.schoolName || "School"
      );
      saveXlsxBuffer(buffer, `${filenamePrefix}_${schoolTag}_${stamp}.xlsx`);
      flash(
        "success",
        `Exported ${blocks.length} day(s) in a single sheet.`
      );
    } catch (err) {
      console.error("Excel export failed:", err);
      flash("error", "Excel export failed. Check the browser console.");
    }
  }

  function exportDaywisePdf(blocks, title) {
    if (!schedule.length) {
      flash("warn", "Bell schedule is empty. Generate the bell schedule first.");
      return;
    }
    if (!blocks.length) {
      flash("warn", "Nothing to export.");
      return;
    }
    openPrintDocument(
      buildMultiBlockPrintableHtml({
        title,
        schoolName:
          project?.data?.school?.schoolName || project?.schoolName,
        academicYear:
          project?.data?.school?.academicYear || project?.academicYear,
        blocks,
      })
    );
  }

  function exportDayClassesExcel() {
    exportDaywiseExcel(buildDayBlocksForClasses(), "Daywise_All_Classes");
  }

  function exportDayClassesPdf() {
    exportDaywisePdf(
      buildDayBlocksForClasses(),
      "DAY-WISE ALL CLASSES TIMETABLE"
    );
  }

  function exportDayTeachersExcel() {
    exportDaywiseExcel(buildDayBlocksForTeachers(), "Daywise_All_Teachers");
  }

  function exportDayTeachersPdf() {
    exportDaywisePdf(
      buildDayBlocksForTeachers(),
      "DAY-WISE ALL TEACHERS TIMETABLE"
    );
  }

  function exportSubstitutionExcel() {
    if (!absentTeacherIds.length) {
      flash("warn", "Select at least one absent teacher before exporting.");
      return;
    }
    const dayTag = safeFilename(subDay || "Day");
    exportDaywiseExcel(
      buildDayBlocksForSubstitution(),
      `Substitution_${dayTag}`
    );
  }

    function exportSubstitutionPdf() {
    if (!absentTeacherIds.length) {
      flash("warn", "Select at least one absent teacher before exporting.");
      return;
    }
    exportDaywisePdf(
      buildDayBlocksForSubstitution(),
      `SUBSTITUTION ARRANGEMENTS – ${String(subDay || "").toUpperCase()}`
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
        s.date === substitutionDate &&
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
          (s) =>
            !(s.date === substitutionDate &&
              s.timetableEntryId === absentEntry.id)
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
        const absence = findAbsence(substitutionDate, absentTeacherId);
    const record = {
      id: makeId(),
      date: substitutionDate,
      day: subDay,
      timetableEntryId: absentEntry.id,
      periodId: absentEntry.periodId,
      classId: absentEntry.classId,
      sectionId: absentEntry.sectionId,
      subjectId: absentEntry.subjectId,
      originalTeacherId: absentTeacherId,
      substituteTeacherId,
      reasonCategory: absence?.reasonCategory || "Other",
      reasonNote: absence?.reasonNote || "",
      verifiedStatus: "pending",
      verifiedAt: null,
      createdAt: new Date().toISOString(),
    };
    setSubstitutions((p) => [
      ...p.filter(
        (s) =>
          !(s.date === substitutionDate &&
            s.timetableEntryId === absentEntry.id)
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
                    <div className="tt-export-buttons">
            <button
              type="button"
              className="tt-pdf-button"
              onClick={() => downloadSectionPdf(classItem, section)}
            >
              <Download size={15} /> PDF
            </button>
            <button
              type="button"
              className="tt-excel-button"
              onClick={() => exportSectionExcel(classItem, section)}
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
          </div>
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

                    // Detect a double-period pair: entry + an adjacent
                    // teaching period with the same subject and teacher in
                    // this class-section. Uses `periods` (not `schedule`)
                    // so breaks between the pair don't break detection.
                    const pIndex = periods.findIndex((p) => p.id === item.id);
                    const prevPeriod =
                      pIndex > 0 ? periods[pIndex - 1] : null;
                    const nextPeriod =
                      pIndex >= 0 && pIndex < periods.length - 1
                        ? periods[pIndex + 1]
                        : null;
                    const prevEntry = prevPeriod
                      ? getEntry(day, classItem.id, section.id, prevPeriod.id)
                      : null;
                    const nextEntry = nextPeriod
                      ? getEntry(day, classItem.id, section.id, nextPeriod.id)
                      : null;
                                        const isDoublePair =
                      entry &&
                      ((prevEntry &&
                        prevEntry.subjectId === entry.subjectId &&
                        prevEntry.teacherId === entry.teacherId) ||
                        (nextEntry &&
                          nextEntry.subjectId === entry.subjectId &&
                          nextEntry.teacherId === entry.teacherId));

                    const cellEntries = getAllEntriesAt(
                      day,
                      classItem.id,
                      section.id,
                      item.id
                    );
                    const isParallel = cellEntries.length > 1;

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
                          className={`tt-edit-cell${isParallel ? " tt-edit-cell-parallel" : ""}`}
                          draggable={!!entry && !isParallel}
                          onDragStart={(e) => {
                            if (isParallel) return;
                            handleDragStart(
                              e,
                              day,
                              classItem.id,
                              section.id,
                              item.id
                            );
                          }}
                        >
                                                    {isParallel && (
                            <>
                              <span className="tt-parallel-label">
                                {optionSets.find(
                                  (s) => s.id === cellEntries[0]?.parallelGroup
                                )?.name || "Option Set"}
                              </span>
                              {cellEntries.map((pe) => (
                                <div className="tt-parallel-line" key={pe.id}>
                                  <b>{getName(subjects, pe.subjectId)}</b>
                                  <small>
                                    {pe.teacherId
                                      ? getName(teachers, pe.teacherId)
                                      : "Not assigned"}
                                  </small>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="tt-clear"
                                onClick={() =>
                                  clearCellAt(
                                    day,
                                    classItem.id,
                                    section.id,
                                    item.id
                                  )
                                }
                              >
                                Clear
                              </button>
                            </>
                          )}

                          {!isParallel && (
                            <>
                              {entry && (
                                <GripVertical
                                  size={12}
                                  className="tt-drag-handle"
                                />
                              )}
                              {isDoublePair && (
                                <span
                                  className="tt-double-badge"
                                  title="Consecutive double period"
                                >
                                  Double
                                </span>
                              )}
                              <select
                                className="tt-cell-subject"
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
                                      className="tt-cell-teacher"
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
                            </>
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
                        <div className="tt-export-buttons">
              <button
                type="button"
                className="tt-pdf-button"
                onClick={() => downloadTeacherPdf(teacher)}
              >
                <Download size={15} /> PDF
              </button>
              <button
                type="button"
                className="tt-excel-button"
                onClick={() => exportTeacherExcel(teacher)}
              >
                <FileSpreadsheet size={15} /> Excel
              </button>
            </div>
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
          <div
            className="tt-export-buttons"
            style={{ marginLeft: "auto" }}
          >
            <button
              type="button"
              className="tt-pdf-button"
              onClick={exportDayClassesPdf}
            >
              <Printer size={15} /> PDF (all days)
            </button>
            <button
              type="button"
              className="tt-excel-button"
              onClick={exportDayClassesExcel}
            >
              <FileSpreadsheet size={15} /> Excel (all days)
            </button>
          </div>
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
                                            const cellEntries = entries.filter(
                        (e) =>
                          e.classId === c.id &&
                          e.sectionId === sec.id &&
                          e.periodId === period.id
                      );
                      return (
                        <td key={period.id}>
                          {cellEntries.length > 0 ? (
                            <div className="tt-read-cell">
                              {cellEntries.map((entry) => (
                                <div key={entry.id} style={{ marginBottom: "4px" }}>
                                  <b>{getName(subjects, entry.subjectId)}</b>
                                  <br />
                                  <span>
                                    {getName(teachers, effectiveTeacherId(entry))}
                                  </span>
                                </div>
                              ))}
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
          <div
            className="tt-export-buttons"
            style={{ marginLeft: "auto" }}
          >
            <button
              type="button"
              className="tt-pdf-button"
              onClick={exportDayTeachersPdf}
            >
              <Printer size={15} /> PDF (all days)
            </button>
            <button
              type="button"
              className="tt-excel-button"
              onClick={exportDayTeachersExcel}
            >
              <FileSpreadsheet size={15} /> Excel (all days)
            </button>
          </div>
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
        absence: findAbsence(substitutionDate, id),
      }))
      .filter((r) => r.teacher);

    return (
      <div className="tt-substitution-page">
        <div className="tt-sub-controls">
          <label>
            Date
            <input
              type="date"
              value={substitutionDate}
              onChange={(e) => setSubstitutionDate(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>Day:</span>
            <strong>{subDay}</strong>
          </div>
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
                          toggleAbsentTeacher(t.id, e.target.checked)
                        }
                      />
                      {t.name} {t.nickname ? `(${t.nickname})` : ""}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>

        {absentRows.length > 0 && (
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 10,
            padding: 12, marginBottom: 14, background: "#f8fafc",
          }}>
            <strong style={{ display: "block", marginBottom: 8 }}>
              Reason for absence — {substitutionDate} ({subDay})
            </strong>
            {absentRows.map(({ teacher, absence }) => {
              if (!absence) return null;
              return (
                <div
                  key={teacher.id}
                  style={{
                    display: "flex", gap: 10, alignItems: "center",
                    marginBottom: 6, flexWrap: "wrap",
                  }}
                >
                  <span style={{ minWidth: 180 }}>
                    <b>{teacher.name}</b>
                  </span>
                  <select
                    value={absence.reasonCategory}
                    onChange={(e) =>
                      upsertAbsence({
                        date: substitutionDate,
                        teacherId: teacher.id,
                        reasonCategory: e.target.value,
                      })
                    }
                  >
                    {ABSENCE_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <input
                    value={absence.reasonNote}
                    placeholder="Note (optional)"
                    onChange={(e) =>
                      upsertAbsence({
                        date: substitutionDate,
                        teacherId: teacher.id,
                        reasonNote: e.target.value,
                      })
                    }
                    style={{ flex: 1, minWidth: 200 }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="tt-export-buttons" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="tt-pdf-button"
            onClick={exportSubstitutionPdf}
            disabled={!absentTeacherIds.length}
          >
            <Printer size={15} /> PDF
          </button>
          <button
            type="button"
            className="tt-excel-button"
            onClick={exportSubstitutionExcel}
            disabled={!absentTeacherIds.length}
          >
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>

        {!absentRows.length ? (
          <div className="tt-empty">
            Select the date and choose one or more absent teachers.
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
    s.date === substitutionDate     // ← was: s.day === subDay
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
                                value={currentSub?.substituteTeacherId || ""}
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
          </>
        )}
      </div>
    );
  }

    function renderSubstitutionHistory() {
    const filtered = absences
      .filter((a) => {
        if (historyStatusFilter !== "all" && a.verifiedStatus !== historyStatusFilter)
          return false;
        if (historyReasonFilter !== "all" && a.reasonCategory !== historyReasonFilter)
          return false;
        if (historySearch) {
          const q = historySearch.toLowerCase();
          const haystack = [
            a.date, a.day, a.reasonNote,
            getName(teachers, a.teacherId, ""),
          ].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (b.date || "").localeCompare(a.date || "") ||
          getName(teachers, a.teacherId, "").localeCompare(
            getName(teachers, b.teacherId, "")
          )
      );

    const setStatus = (id, status) =>
      setAbsences((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                verifiedStatus: status,
                verifiedAt: new Date().toISOString(),
              }
            : a
        )
      );

    const removeRecord = (id) => {
      if (!window.confirm("Delete this absence record? This cannot be undone.")) return;
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    };

    const coverage = (a) => {
      const total = timetable.filter(
        (e) => e.day === a.day && e.teacherId === a.teacherId
      ).length;
      const covered = substitutions.filter(
        (s) => s.date === a.date && s.originalTeacherId === a.teacherId
      ).length;
      return { total, covered };
    };

    return (
      <div>
        <div className="tt-toolbar" style={{ flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search teacher / reason / date…"
            style={{ minWidth: 260 }}
          />
          <label>
            Status
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">⏳ Pending</option>
              <option value="covered">✓ Covered</option>
              <option value="not-covered">✗ Not Covered</option>
            </select>
          </label>
          <label>
            Reason
            <select
              value={historyReasonFilter}
              onChange={(e) => setHistoryReasonFilter(e.target.value)}
            >
              <option value="all">All</option>
              {ABSENCE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            className="tt-excel-button"
            onClick={exportSubstitutionLogExcel}
            disabled={!absences.length}
          >
            <FileSpreadsheet size={15} /> Audit Log (Excel)
          </button>
          <button
            className="tt-pdf-button"
            onClick={exportSubstitutionLogPdf}
            disabled={!absences.length}
          >
            <Printer size={15} /> Audit Log (PDF)
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="tt-empty">No absence records match the filters.</div>
        ) : (
          <div className="tt-table-wrap">
            <table className="tt-table tt-compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Teacher</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th>Coverage</th>
                  <th>Status</th>
                  <th>Verified At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const c = coverage(a);
                  return (
                    <tr key={a.id}>
                      <td>{a.date || "—"}</td>
                      <td>{a.day || "—"}</td>
                      <td>{getName(teachers, a.teacherId)}</td>
                      <td>{a.reasonCategory}</td>
                      <td>{a.reasonNote || "—"}</td>
                      <td>
                        <b>{c.covered}</b>/{c.total} periods
                      </td>
                      <td>
                        <select
                          value={a.verifiedStatus}
                          onChange={(e) => setStatus(a.id, e.target.value)}
                        >
                          <option value="pending">⏳ Pending</option>
                          <option value="covered">✓ Covered</option>
                          <option value="not-covered">✗ Not Covered</option>
                        </select>
                      </td>
                      <td>
                        {a.verifiedAt
                          ? new Date(a.verifiedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="tt-remove"
                          onClick={() => removeRecord(a.id)}
                          title="Delete record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function buildAbsenceLogHeaders() {
    return [
      "Date", "Day", "Teacher", "Reason", "Note",
      "Periods Covered", "Total Periods", "Status", "Verified At",
    ];
  }

  function buildAbsenceLogRow(a) {
    const total = timetable.filter(
      (e) => e.day === a.day && e.teacherId === a.teacherId
    ).length;
    const covered = substitutions.filter(
      (s) => s.date === a.date && s.originalTeacherId === a.teacherId
    ).length;
    return [
      a.date || "—",
      a.day || "—",
      getName(teachers, a.teacherId),
      a.reasonCategory || "—",
      a.reasonNote || "—",
      String(covered),
      String(total),
      a.verifiedStatus || "pending",
      a.verifiedAt ? new Date(a.verifiedAt).toLocaleString() : "—",
    ];
  }

  async function exportSubstitutionLogExcel() {
    if (!absences.length) return flash("warn", "No records to export.");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Absence Log", {
        pageSetup: {
          paperSize: 9, orientation: "landscape",
          fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        },
      });
      sheet.getRow(1).values = buildAbsenceLogHeaders();
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: "center" };
      absences
        .slice()
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .forEach((a, idx) => {
          sheet.getRow(idx + 2).values = buildAbsenceLogRow(a);
        });
      [12, 10, 22, 20, 26, 14, 12, 14, 20].forEach(
        (w, i) => (sheet.getColumn(i + 1).width = w)
      );
      const buffer = await workbook.xlsx.writeBuffer();
      saveXlsxBuffer(
        buffer,
        `Absence_Audit_Log_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      flash("success", `Exported ${absences.length} record(s).`);
    } catch (err) {
      console.error(err);
      flash("error", "Audit log export failed.");
    }
  }

  function exportSubstitutionLogPdf() {
    if (!absences.length) return flash("warn", "No records to export.");
    const headers = buildAbsenceLogHeaders();
    const rows = absences
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(buildAbsenceLogRow);
    openPrintDocument(
      buildMultiBlockPrintableHtml({
        title: "ABSENCE & SUBSTITUTION AUDIT LOG",
        schoolName:
          project?.data?.school?.schoolName || project?.schoolName,
        academicYear:
          project?.data?.school?.academicYear || project?.academicYear,
        blocks: [{ heading: "All Absences", headers, rows }],
      })
    );
  }
      const tabs = [
    ["class", "Class-wise Timetable", School],
    ["teacher", "Teacher-wise Timetable", UserRound],
    ["dayClasses", "Day-wise All Classes", CalendarRange],
    ["dayTeachers", "Day-wise All Teachers", Users],
    ["substitution", "Substitution Arrangements", ArrowLeftRight],
    ["subHistory", "Substitution History", ListChecks],
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
            {substitutions.some(s => s.date === substitutionDate) && (
              <span style={{ marginLeft: 12, color: "#d97706", fontSize: 12, fontWeight: 600 }}>
                ⚠ Substitutions active for {substitutionDate}
              </span>
            )}
          </p>
        </div>
                <div className="tt-header-actions">
          <div style={{ display: "flex", gap: "6px", marginRight: "10px" }}>
            <button
              type="button"
              className="tt-print"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} /> Undo
            </button>
            <button
              type="button"
              className="tt-print"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} /> Redo
            </button>
          </div>
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
        <div className="tt-builder-config-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center" }}>
              <Wand2 size={18} style={{ marginRight: 8, color: "#2457c5" }} />
              Auto-generate Timetable
            </h2>
          </div>
                    <div style={{ display: "flex", gap: "10px" }}>
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
                <RotateCcw size={14} /> Clear
              </button>
            )}
            <button
              type="button"
              className="tt-generate-button"
              onClick={autoGenerate}
              disabled={isGenerating}
              style={{ padding: "10px 20px", fontSize: "14px" }}
            >
              {isGenerating ? "Generating..." : "Generate Timetable"}
            </button>
          </div>
        </div>

        <details style={{ marginTop: "16px" }}>
          <summary style={{ cursor: "pointer", color: "#2457c5", fontWeight: 600, fontSize: "13px", outline: "none" }}>
            ⚙️ Click here to adjust generation settings and fixed rules
          </summary>
          
          <div style={{ marginTop: "16px", borderTop: "1px solid #dce3ec", paddingTop: "16px" }}>
            
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
                Regenerate Unlocked
              </button>
            </div>
            
            <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 12px" }}>
              Manually edited, dragged, or teacher-assigned periods are locked 🔒 and
              preserved in both modes. Only unlocked periods are regenerated. Use
              "Clear Timetable" to start from scratch.
            </p>

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
              <label>
                Max teacher periods / day
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={genConfig.maxTeacherPeriodsPerDay}
                  onChange={(e) =>
                    setGenConfig({
                      ...genConfig,
                      maxTeacherPeriodsPerDay: Math.max(0, Number(e.target.value) || 0),
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

          </div>
        </details>
      </section>

      {/* Bulk Export */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b", alignSelf: "center", marginRight: "10px" }}>
          Bulk Download:
        </span>
        <button
          type="button"
          className="tt-excel-button"
          onClick={exportAllSectionsExcel}
          disabled={!classes.length || !schedule.length}
        >
          <FileSpreadsheet size={15} /> All Class-Sections
        </button>
        <button
          type="button"
          className="tt-excel-button"
          onClick={exportAllTeachersExcel}
          disabled={!teachers.length || !schedule.length}
        >
          <FileSpreadsheet size={15} /> All Teachers
        </button>
      </div>

            {notice && (
        <div
          className={`tt-notice tt-notice-${noticeKind}`}
          role="status"
                    style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 9999,
            width: "380px",
            maxWidth: "calc(100vw - 48px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span style={{ flex: 1 }}>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            style={{
              flexShrink: 0,
              background: "rgba(0,0,0,0.05)",
              borderRadius: "4px",
              padding: "4px 8px",
              marginLeft: "10px",
            }}
          >
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
        {view === "subHistory" && renderSubstitutionHistory()}

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