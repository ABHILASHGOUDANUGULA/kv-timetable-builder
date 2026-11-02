import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarDays, CheckCircle2, Download, Printer,
  School, Users, UserRound, CalendarRange, ArrowLeftRight,
} from "lucide-react";
import "../styles/timetable-builder.css";

const safeArray = (value) => Array.isArray(value) ? value : [];
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const getName = (items, id, fallback = "—") => items.find((item) => item.id === id)?.name || fallback;
const getSections = (classItem) => safeArray(classItem?.sections).filter((section) => section.active !== false);
const timeText = (item) => item?.start && item?.end ? `${item.start}–${item.end}` : "";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function getSchedule(project) {
  return safeArray(project?.data?.bellSchedule?.schedule).map((item, index) => ({
    ...item,
    id: item.id || `legacy-${item.type || "item"}-${index + 1}`,
    name: item.name || (item.type === "break" ? "Break" : `Period ${index + 1}`),
  })).filter((item) => item.type === "period" || item.type === "break");
}

function getDays(project) {
  const days = safeArray(project?.data?.school?.workingDays);
  return days.length ? days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
}

function slotId(day, classId, sectionId, periodId) {
  return `${day}::${classId}::${sectionId}::${periodId}`;
}

function buildPrintableHtml({ title, schoolName, academicYear, headers, rows }) {
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowsHtml = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}h2{text-align:center;font-size:16px;margin:0 0 4px}h3{text-align:center;font-size:13px;margin:0 0 10px;font-weight:600}.meta{text-align:center;font-size:10px;margin-bottom:8px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #333;padding:5px 3px;text-align:center;vertical-align:middle;font-size:9px;overflow-wrap:anywhere}th{background:#eef2f7;font-weight:700}td:first-child,th:first-child{width:12%}.subject{font-weight:700}.teacher{display:block;font-size:8px;margin-top:3px;color:#333}.break{background:#f1f1f1;font-weight:700}@media print{tr{break-inside:avoid}thead{display:table-header-group}}
    </style></head><body><h2>${escapeHtml(schoolName || "School")}</h2><h3>${escapeHtml(title)}</h3><div class="meta">Academic Year: ${escapeHtml(academicYear || "")}</div><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`;
}

function openPrintDocument(html) {
  const printWindow = window.open("", "_blank", "width=1200,height=850");
  if (!printWindow) {
    alert("Please allow pop-ups for this site to print or save the PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function TimetableBuilder({ project, onSaveTimetable, onSaveSubstitutions }) {
  const classes = useMemo(() => safeArray(project?.data?.classes).filter((item) => item.active !== false), [project]);
  const subjects = useMemo(() => safeArray(project?.data?.subjects).filter((item) => item.active !== false), [project]);
  const teachers = useMemo(() => safeArray(project?.data?.teachers).filter((item) => item.active !== false), [project]);
  const subjectMappings = safeArray(project?.data?.mappings);
  const teacherMappings = safeArray(project?.data?.teacherMappings);
  const schedule = useMemo(() => getSchedule(project), [project]);
  const periods = useMemo(() => schedule.filter((item) => item.type === "period"), [schedule]);
  const days = useMemo(() => getDays(project), [project]);

  const [view, setView] = useState("class");
  const [timetable, setTimetable] = useState(() => safeArray(project?.data?.timetable));
  const [substitutions, setSubstitutions] = useState(() => safeArray(project?.data?.substitutions));
  const [notice, setNotice] = useState("");
  const [subDay, setSubDay] = useState(days[0] || "Monday");
  const [selectedDay, setSelectedDay] = useState(days[0] || "Monday");
  const [absentTeacherIds, setAbsentTeacherIds] = useState([]);
  const [searchAbsent, setSearchAbsent] = useState("");
  const [showAbsentList, setShowAbsentList] = useState(false);
  const saveTimetableRef = useRef(onSaveTimetable);
  const saveSubstitutionsRef = useRef(onSaveSubstitutions);

  useEffect(() => { saveTimetableRef.current = onSaveTimetable; }, [onSaveTimetable]);
  useEffect(() => { saveSubstitutionsRef.current = onSaveSubstitutions; }, [onSaveSubstitutions]);

  useEffect(() => {
    setTimetable(safeArray(project?.data?.timetable));
    setSubstitutions(safeArray(project?.data?.substitutions));
    setAbsentTeacherIds([]);
    setSubDay(getDays(project)[0] || "Monday");
    setSelectedDay(getDays(project)[0] || "Monday");
    setNotice("");
  }, [project?.id]);

  useEffect(() => {
    const timer = setTimeout(() => saveTimetableRef.current?.(timetable), 450);
    return () => clearTimeout(timer);
  }, [timetable, project?.id]);

  useEffect(() => {
    const timer = setTimeout(() => saveSubstitutionsRef.current?.(substitutions), 450);
    return () => clearTimeout(timer);
  }, [substitutions, project?.id]);

  function getMappedSubjects(classId) {
    return subjectMappings.filter((mapping) => mapping.classId === classId && subjects.some((subject) => subject.id === mapping.subjectId) && Number(mapping.periodsPerWeek) > 0);
  }

  function getMappedTeacher(classId, sectionId, subjectId) {
    const matches = teacherMappings.filter((mapping) => mapping.classId === classId && mapping.sectionId === sectionId && mapping.subjectId === subjectId && teachers.some((teacher) => teacher.id === mapping.teacherId));
    const unique = [...new Map(matches.map((mapping) => [mapping.teacherId, mapping])).values()];
    return { teacher: unique.length === 1 ? teachers.find((teacher) => teacher.id === unique[0].teacherId) : null, count: unique.length };
  }

  function getEntry(day, classId, sectionId, periodId) {
    return timetable.find((entry) => entry.day === day && entry.classId === classId && entry.sectionId === sectionId && entry.periodId === periodId);
  }

  function getSubstitution(entry) {
    return substitutions.find((item) => item.timetableEntryId === entry.id);
  }

  function effectiveTeacherId(entry) {
    return getSubstitution(entry)?.substituteTeacherId || entry.teacherId;
  }

  function teacherIsBusy(teacherId, day, periodId, excludeEntryId = "") {
    if (!teacherId) return false;
    return timetable.some((entry) => entry.id !== excludeEntryId && entry.day === day && entry.periodId === periodId && effectiveTeacherId(entry) === teacherId);
  }

  function saveSlot(day, classId, sectionId, periodId, subjectId) {
    const mapped = getMappedTeacher(classId, sectionId, subjectId);
    const existing = getEntry(day, classId, sectionId, periodId);
    if (!subjectId) {
      if (existing) {
        setTimetable((previous) => previous.filter((item) => item.id !== existing.id));
        setSubstitutions((previous) => previous.filter((item) => item.timetableEntryId !== existing.id));
      }
      setNotice("");
      return;
    }
    if (mapped.count === 0) {
      setNotice("No teacher is mapped to this subject for this class and section. Complete Teacher Mapping first.");
    } else if (mapped.count > 1) {
      setNotice("More than one teacher is mapped to this subject and section. Correct Teacher Mapping so only one teacher is assigned.");
    }
    let teacherId = mapped.teacher?.id || "";
    if (teacherId && teacherIsBusy(teacherId, day, periodId, existing?.id || "")) {
      setNotice(`${mapped.teacher.name} is already assigned in another class during this period. The subject is saved without a teacher until the clash is resolved.`);
      teacherId = "";
    } else if (mapped.teacher) {
      setNotice("");
    }
    const record = {
      id: existing?.id || makeId(), day, classId, sectionId, periodId,
      subjectId, teacherId, updatedAt: new Date().toISOString(),
    };
    setTimetable((previous) => existing ? previous.map((item) => item.id === existing.id ? record : item) : [...previous, record]);
    if (existing) setSubstitutions((previous) => previous.filter((item) => item.timetableEntryId !== existing.id));
  }

  function clearSlot(entry) {
    setTimetable((previous) => previous.filter((item) => item.id !== entry.id));
    setSubstitutions((previous) => previous.filter((item) => item.timetableEntryId !== entry.id));
    setNotice("Period cleared.");
  }

  function placedCount(classId, sectionId, subjectId) {
    return timetable.filter((entry) => entry.classId === classId && entry.sectionId === sectionId && entry.subjectId === subjectId && entry.teacherId).length;
  }

  function renderSectionTable(classItem, section) {
    const sectionMappings = getMappedSubjects(classItem.id);
    return <div className="tt-section-card" key={`${classItem.id}-${section.id}`}>
      <div className="tt-section-heading">
        <div><h3>{classItem.name} – Section {section.name}</h3><span>{sectionMappings.reduce((sum, item) => sum + placedCount(classItem.id, section.id, item.subjectId), 0)} periods assigned</span></div>
        <button type="button" className="tt-pdf-button" onClick={() => downloadSectionPdf(classItem, section)}><Download size={15}/> Download PDF</button>
      </div>
      <div className="tt-table-wrap"><table className="tt-table tt-edit-table"><thead><tr><th>Day</th>{schedule.map((item) => <th key={item.id} className={item.type === "break" ? "tt-break-heading" : ""}>{item.name}<small>{timeText(item)}</small></th>)}</tr></thead>
        <tbody>{days.map((day) => <tr key={day}><th>{day}</th>{schedule.map((item) => {
          if (item.type === "break") return <td key={item.id} className="tt-break-cell">{item.name}</td>;
          const entry = getEntry(day, classItem.id, section.id, item.id);
          const mapped = getMappedSubjects(classItem.id);
          return <td key={item.id}><div className="tt-edit-cell">
            <select aria-label={`${classItem.name} ${section.name} ${day} ${item.name} subject`} value={entry?.subjectId || ""} onChange={(event) => saveSlot(day, classItem.id, section.id, item.id, event.target.value)}>
              <option value="">— Subject —</option>{mapped.map((mapping) => <option key={mapping.subjectId} value={mapping.subjectId}>{getName(subjects, mapping.subjectId)}</option>)}
            </select>
            <small className={entry?.subjectId && !entry?.teacherId ? "tt-unassigned" : "tt-teacher-name"}>{entry?.teacherId ? getName(teachers, entry.teacherId) : entry?.subjectId ? (getMappedTeacher(classItem.id, section.id, entry.subjectId).count > 1 ? "Multiple mapped teachers" : "Teacher not assigned / clash") : ""}</small>
            {entry && <button type="button" className="tt-clear" onClick={() => clearSlot(entry)}>Clear</button>}
          </div></td>;
        })}</tr>)}</tbody></table></div>
      <div className="tt-requirement-strip">{sectionMappings.map((mapping) => <span key={mapping.subjectId}>{getName(subjects, mapping.subjectId)}: <b>{placedCount(classItem.id, section.id, mapping.subjectId)}/{Number(mapping.periodsPerWeek)}</b></span>)}</div>
    </div>;
  }

  function downloadSectionPdf(classItem, section) {
    const headers = ["Day", ...schedule.map((item) => `${item.name}${timeText(item) ? ` (${timeText(item)})` : ""}`)];
    const rows = days.map((day) => [day, ...schedule.map((item) => {
      if (item.type === "break") return item.name;
      const entry = getEntry(day, classItem.id, section.id, item.id);
      return entry ? `${getName(subjects, entry.subjectId)}${entry.teacherId ? `\n${getName(teachers, entry.teacherId)}` : "\nTeacher not assigned"}` : "—";
    })]);
    const html = buildPrintableHtml({ title: `CLASS ${classItem.name} – SECTION ${section.name} TIMETABLE`, schoolName: project?.data?.school?.schoolName || project?.schoolName, academicYear: project?.data?.school?.academicYear || project?.academicYear, headers, rows });
    openPrintDocument(html);
  }

  function renderTeacherTables() {
    return teachers.map((teacher) => {
      const entries = timetable.filter((entry) => effectiveTeacherId(entry) === teacher.id);
      return <div className="tt-section-card" key={teacher.id}><div className="tt-section-heading"><div><h3>{teacher.name}{teacher.nickname ? ` (${teacher.nickname})` : ""}</h3><span>{entries.length} assigned periods</span></div><button type="button" className="tt-pdf-button" onClick={() => downloadTeacherPdf(teacher)}><Download size={15}/> Download PDF</button></div>
        <div className="tt-table-wrap"><table className="tt-table tt-compact"><thead><tr><th>Day</th>{schedule.map((item) => <th key={item.id}>{item.name}<small>{timeText(item)}</small></th>)}</tr></thead><tbody>{days.map((day) => <tr key={day}><th>{day}</th>{schedule.map((item) => { if (item.type === "break") return <td key={item.id} className="tt-break-cell">{item.name}</td>; const entry = entries.find((candidate) => candidate.day === day && candidate.periodId === item.id); return <td key={item.id}>{entry ? <div className="tt-read-cell"><b>{getName(subjects, entry.subjectId)}</b><span>{getName(classes, entry.classId)} – {getName(getSections(classes.find((c) => c.id === entry.classId)), entry.sectionId)}</span>{getSubstitution(entry) && <small>Substitution</small>}</div> : <span className="tt-dash">—</span>}</td>; })}</tr>)}</tbody></table></div></div>;
    });
  }

  function downloadTeacherPdf(teacher) {
    const headers = ["Day", ...schedule.map((item) => `${item.name}${timeText(item) ? ` (${timeText(item)})` : ""}`)];
    const rows = days.map((day) => [day, ...schedule.map((item) => { if (item.type === "break") return item.name; const entry = timetable.find((candidate) => candidate.day === day && candidate.periodId === item.id && effectiveTeacherId(candidate) === teacher.id); return entry ? `${getName(subjects, entry.subjectId)}\n${getName(classes, entry.classId)}-${getName(getSections(classes.find((c) => c.id === entry.classId)), entry.sectionId)}` : "—"; })]);
    openPrintDocument(buildPrintableHtml({ title: `TEACHER TIMETABLE – ${teacher.name}`, schoolName: project?.data?.school?.schoolName || project?.schoolName, academicYear: project?.data?.school?.academicYear || project?.academicYear, headers, rows }));
  }

  function getDayEntries(day) { return timetable.filter((entry) => entry.day === day); }
  function teacherFreePeriods(teacherId, day) {
    return periods.filter((period) => !timetable.some((entry) => entry.day === day && entry.periodId === period.id && effectiveTeacherId(entry) === teacherId)).length;
  }
  function isFreeForSubstitution(teacherId, day, periodId) {
    if (absentTeacherIds.includes(teacherId)) return false;
    const alreadySubstituted = substitutions.some((item) => item.day === day && item.periodId === periodId && item.substituteTeacherId === teacherId);
    return !alreadySubstituted && !timetable.some((entry) => entry.day === day && entry.periodId === periodId && effectiveTeacherId(entry) === teacherId);
  }
  function assignSubstitute(absentTeacherId, absentEntry, substituteTeacherId) {
    if (!substituteTeacherId) {
      setSubstitutions((previous) => previous.filter((item) => !(item.day === subDay && item.timetableEntryId === absentEntry.id)));
      return;
    }
    if (!isFreeForSubstitution(substituteTeacherId, subDay, absentEntry.periodId)) {
      setNotice("This teacher is not free in the selected period.");
      return;
    }
    const record = { id: makeId(), timetableEntryId: absentEntry.id, day: subDay, periodId: absentEntry.periodId, classId: absentEntry.classId, sectionId: absentEntry.sectionId, subjectId: absentEntry.subjectId, originalTeacherId: absentTeacherId, substituteTeacherId, reason: "Absent teacher" };
    setSubstitutions((previous) => [...previous.filter((item) => !(item.day === subDay && item.timetableEntryId === absentEntry.id)), record]);
    setNotice("");
  }

  function renderSubstitutionView() {
    const absentRows = absentTeacherIds.map((teacherId) => {
      const teacher = teachers.find((item) => item.id === teacherId);
      const teacherEntries = getDayEntries(subDay).filter((entry) => entry.teacherId === teacherId);
      return { teacher, teacherEntries };
    }).filter((item) => item.teacher);
    return <div className="tt-substitution-page">
      <div className="tt-sub-controls"><label>Day<select value={subDay} onChange={(event) => setSubDay(event.target.value)}>{days.map((day) => <option key={day}>{day}</option>)}</select></label>
        <div className="tt-absent-picker"><label>Absent teachers</label><button type="button" className="tt-absent-toggle" onClick={() => setShowAbsentList((value) => !value)}>{absentTeacherIds.length ? `${absentTeacherIds.length} teacher(s) selected` : "Select absent teachers"} ▾</button>
          {showAbsentList && <div className="tt-absent-list"><input value={searchAbsent} onChange={(event) => setSearchAbsent(event.target.value)} placeholder="Search teachers" />{teachers.filter((teacher) => `${teacher.name} ${teacher.nickname || ""}`.toLowerCase().includes(searchAbsent.toLowerCase())).map((teacher) => <label key={teacher.id}><input type="checkbox" checked={absentTeacherIds.includes(teacher.id)} onChange={(event) => setAbsentTeacherIds((previous) => event.target.checked ? [...previous, teacher.id] : previous.filter((id) => id !== teacher.id))}/>{teacher.name} {teacher.nickname ? `(${teacher.nickname})` : ""}</label>)}</div>}
        </div></div>
      {!absentRows.length ? <div className="tt-empty">Select the day and choose one or more absent teachers from the complete teacher list.</div> : <>
        <div className="tt-table-wrap"><table className="tt-table tt-arrangement-table"><thead><tr><th>Absent teacher</th>{schedule.map((item) => <th key={item.id}>{item.name}<small>{timeText(item)}</small></th>)}</tr></thead><tbody>{absentRows.map(({ teacher, teacherEntries }) => <tr key={teacher.id}><th>{teacher.name}</th>{schedule.map((period) => { if (period.type === "break") return <td key={period.id} className="tt-break-cell">{period.name}</td>; const entry = teacherEntries.find((item) => item.periodId === period.id); if (!entry) return <td key={period.id}><span className="tt-dash">Free / No class</span></td>; const currentSub = substitutions.find((item) => item.timetableEntryId === entry.id && item.day === subDay); const options = teachers.filter((candidate) => isFreeForSubstitution(candidate.id, subDay, period.id) || candidate.id === currentSub?.substituteTeacherId).sort((a, b) => teacherFreePeriods(b.id, subDay) - teacherFreePeriods(a.id, subDay)); return <td key={period.id}><div className="tt-arrangement-cell"><b>{getName(classes, entry.classId)}-{getName(getSections(classes.find((c) => c.id === entry.classId)), entry.sectionId)}</b><span>{getName(subjects, entry.subjectId)}</span><select value={currentSub?.substituteTeacherId || ""} onChange={(event) => assignSubstitute(teacher.id, entry, event.target.value)}><option value="">Select free teacher</option>{options.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({teacherFreePeriods(candidate.id, subDay)})</option>)}</select></div></td>; })}</tr>)}</tbody></table></div>
        <div className="tt-sub-summary"><b>Free-period availability for {subDay}</b><div>{teachers.filter((teacher) => !absentTeacherIds.includes(teacher.id)).map((teacher) => <span key={teacher.id}>{teacher.name} <b>({teacherFreePeriods(teacher.id, subDay)})</b></span>)}</div></div>
      </>}
    </div>;
  }

  function renderDayClasses() {
    const entries = getDayEntries(selectedDay);
    return <><div className="tt-toolbar"><label>Day<select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>{days.map((day) => <option key={day}>{day}</option>)}</select></label></div><div className="tt-table-wrap"><table className="tt-table tt-compact"><thead><tr><th>Class / Section</th>{schedule.map((item) => <th key={item.id}>{item.name}<small>{timeText(item)}</small></th>)}</tr></thead><tbody>{classes.flatMap((classItem) => getSections(classItem).map((section) => <tr key={`${classItem.id}-${section.id}`}><th>{classItem.name}-{section.name}</th>{schedule.map((period) => { if (period.type === "break") return <td key={period.id} className="tt-break-cell">{period.name}</td>; const entry = entries.find((item) => item.classId === classItem.id && item.sectionId === section.id && item.periodId === period.id); return <td key={period.id}>{entry ? <div className="tt-read-cell"><b>{getName(subjects, entry.subjectId)}</b><span>{getName(teachers, effectiveTeacherId(entry))}</span></div> : <span className="tt-dash">—</span>}</td>; })}</tr>))}</tbody></table></div></>;
  }

  function renderDayTeachers() {
    const entries = getDayEntries(selectedDay);
    return <><div className="tt-toolbar"><label>Day<select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>{days.map((day) => <option key={day}>{day}</option>)}</select></label></div><div className="tt-table-wrap"><table className="tt-table tt-compact"><thead><tr><th>Teacher</th>{schedule.map((item) => <th key={item.id}>{item.name}<small>{timeText(item)}</small></th>)}</tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id}><th>{teacher.name}</th>{schedule.map((period) => { if (period.type === "break") return <td key={period.id} className="tt-break-cell">{period.name}</td>; const entry = entries.find((item) => effectiveTeacherId(item) === teacher.id && item.periodId === period.id); return <td key={period.id}>{entry ? <div className="tt-read-cell"><b>{getName(subjects, entry.subjectId)}</b><span>{getName(classes, entry.classId)}-{getName(getSections(classes.find((c) => c.id === entry.classId)), entry.sectionId)}</span></div> : <span className="tt-dash">—</span>}</td>; })}</tr>)}</tbody></table></div></>;
  }

  const clashGroups = useMemo(() => {
    const counts = new Map();
    timetable.filter((entry) => entry.teacherId).forEach((entry) => { const key = `${entry.day}::${entry.periodId}::${effectiveTeacherId(entry)}`; counts.set(key, (counts.get(key) || 0) + 1); });
    return [...counts.values()].filter((count) => count > 1).length;
  }, [timetable, substitutions]);

  const tabs = [
    ["class", "Class-wise Timetable", School],
    ["teacher", "Teacher-wise Timetable", UserRound],
    ["dayClasses", "Day-wise All Classes", CalendarRange],
    ["dayTeachers", "Day-wise All Teachers", Users],
    ["substitution", "Substitution Arrangements", ArrowLeftRight],
  ];
  const activeSections = classes.reduce((sum, item) => sum + getSections(item).length, 0);
  const assignedCount = timetable.filter((entry) => entry.subjectId && entry.teacherId).length;

  return <div className="timetable-builder-page">
    <header className="tt-header"><div><div className="tt-eyebrow">TIMETABLE WORKSPACE / BUILD & REVIEW</div><h1>Timetable Builder</h1><p>{project?.data?.school?.schoolName || project?.schoolName || "School"} · {project?.data?.school?.academicYear || project?.academicYear || ""}</p></div><div className="tt-header-actions"><span className="tt-save-state"><CheckCircle2 size={15}/> Auto-saved</span><button className="tt-print" type="button" onClick={() => window.print()}><Printer size={16}/> Print current view</button></div></header>
    <div className="tt-summary"><div><span>Classes / Sections</span><strong>{classes.length} / {activeSections}</strong></div><div><span>Active teachers</span><strong>{teachers.length}</strong></div><div><span>Assigned periods</span><strong>{assignedCount}</strong></div><div><span>Teacher clashes</span><strong className={clashGroups ? "tt-bad" : "tt-good"}>{clashGroups}</strong></div></div>
    {notice && <div className="tt-notice" role="status"><AlertTriangle size={16}/>{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
    {(!schedule.length || !classes.length || !subjects.length || !teachers.length) && <div className="tt-warning"><AlertTriangle size={17}/> Complete Bell Schedule, Classes, Subjects and Teachers before building the timetable.</div>}
    <nav className="tt-tabs">{tabs.map(([id, title, Icon]) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={16}/>{title}</button>)}</nav>
    <section className="tt-panel">
      {view === "class" && (classes.length ? classes.map((classItem) => <div className="tt-class-group" key={classItem.id}><h2>{classItem.name}</h2>{getSections(classItem).length ? getSections(classItem).map((section) => renderSectionTable(classItem, section)) : <div className="tt-empty">No active sections in {classItem.name}.</div>}</div>) : <div className="tt-empty">Add active classes and sections first.</div>)}
      {view === "teacher" && (teachers.length ? renderTeacherTables() : <div className="tt-empty">Add active teachers first.</div>)}
      {view === "dayClasses" && renderDayClasses()}
      {view === "dayTeachers" && renderDayTeachers()}
      {view === "substitution" && renderSubstitutionView()}
    </section>
    <p className="tt-footnote">Class-wise timetable is the master timetable. Teacher-wise and day-wise views are generated from it. Substitution assignments are stored separately and do not overwrite regular teacher mappings.</p>
  </div>;
}
