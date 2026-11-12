import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Search,
  Check,
  X,
  UserRound,
  BookOpen,
  GraduationCap,
  Trash2,
  UserPlus,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Copy,
  Undo2,
  Filter,
} from "lucide-react";

import "../styles/teacher-mapping.css";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const safeArray = (v) => (Array.isArray(v) ? v : []);
const asId = (value) => (value === null || value === undefined ? "" : String(value));
const safeName = (value) => String(value ?? "").trim();
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Two mappings belong to the same "split group" when they share class, section and subject.
function sameGroup(mapping, classId, sectionId, subjectId) {
  return (
    asId(mapping?.classId) === asId(classId) &&
    asId(mapping?.sectionId) === asId(sectionId) &&
    asId(mapping?.subjectId) === asId(subjectId)
  );
}

// Divide `required` weekly periods as evenly as possible among teacher ids.
function evenSplit(teacherIds, required) {
  if (!teacherIds.length) return {};
  const base = Math.floor(required / teacherIds.length);
  let extra = required % teacherIds.length;
  const result = {};
  teacherIds.forEach((id) => {
    result[id] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
  });
  return result;
}

export default function TeacherMapping({ project, onSave, onContinue }) {
  // ==========================================
  // 1. PROJECT DATA
  // ==========================================
  const teachers = useMemo(
    () => safeArray(project?.data?.teachers).filter((t) => t && t.active !== false && asId(t.id)),
    [project?.data?.teachers]
  );
    // FIX: Keep a list of ALL teachers (including archived) so their names still show up in history
  const allTeachers = useMemo(
    () => safeArray(project?.data?.teachers).filter((t) => t && asId(t.id)),
    [project?.data?.teachers]
  );

  const classes = useMemo(
    () => safeArray(project?.data?.classes).filter((c) => c && c.active !== false && asId(c.id)),
    [project?.data?.classes]
  );

  const subjects = useMemo(
    () => safeArray(project?.data?.subjects).filter((s) => s && s.active !== false && asId(s.id)),
    [project?.data?.subjects]
  );

  const classSubjectMappings = useMemo(
    () => safeArray(project?.data?.mappings),
    [project?.data?.mappings]
  );

  // ==========================================
  // 2. STATES
  // ==========================================
  const [teacherMappings, setTeacherMappings] = useState(() =>
    normalizeAll(safeArray(project?.data?.teacherMappings).map((m) => ({
      ...m,
      id: asId(m?.id) || makeId(),
      teacherId: asId(m?.teacherId),
      classId: asId(m?.classId),
      sectionId: asId(m?.sectionId),
      subjectId: asId(m?.subjectId),
      periodsAllocated: Math.max(0, Number(m?.periodsAllocated) || 0),
    })).filter((m) => m.teacherId && m.classId && m.subjectId))
  );

  const [allotmentMode, setAllotmentMode] = useState("teacher");

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Teacher-first workflow: multi-select classes and expand them inline.
  const [teacherSelectedClasses, setTeacherSelectedClasses] = useState([]);
  // Section-level selection keyed by class ID; only checked sections are allotment targets.
  const [teacherSelectedSections, setTeacherSelectedSections] = useState({});
  const [teacherExpandedClasses, setTeacherExpandedClasses] = useState([]);
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [assignmentHistory, setAssignmentHistory] = useState([]);

  // Class-wise selection
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [teacherPeriodAllocations, setTeacherPeriodAllocations] = useState({});

  const [searchTeacher, setSearchTeacher] = useState("");
  const [searchAvailableTeacher, setSearchAvailableTeacher] = useState("");

  const [reviewMode, setReviewMode] = useState("teacher");
  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved");

  // ==========================================
  // 3. SAVE INFRASTRUCTURE (refs)
  // ==========================================
  const onSaveRef = useRef(onSave);
  const isFirstRender = useRef(true);
  const isFirstMount = useRef(true);
  const lastProjectIdRef = useRef(project?.id);

  // Tracks the pending debounced save so it can be flushed on unmount
  // or before a project switch. `{ data, onSave, timerId }`.
  const pendingSaveRef = useRef(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // ==========================================
  // 4. PROJECT SWITCHING
  // ==========================================
  // Flush any pending save (using the save handler captured when the
  // pending save was scheduled) BEFORE the new project's data replaces
  // the current state.
  useLayoutEffect(() => {
    if (lastProjectIdRef.current === project?.id) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timerId);
      const { data, onSave: saveFn } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveFn?.(data);
    }

    lastProjectIdRef.current = project?.id;
  }, [project?.id]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setTeacherMappings(normalizeAll(safeArray(project?.data?.teacherMappings).map((m) => ({
      ...m,
      id: asId(m?.id) || makeId(),
      teacherId: asId(m?.teacherId),
      classId: asId(m?.classId),
      sectionId: asId(m?.sectionId),
      subjectId: asId(m?.subjectId),
      periodsAllocated: Math.max(0, Number(m?.periodsAllocated) || 0),
    })).filter((m) => m.teacherId && m.classId && m.subjectId)));
    setTeacherPeriodAllocations({});

    setSelectedTeacher("");
    setTeacherSelectedClasses([]);
    setTeacherSelectedSections({});
    setTeacherExpandedClasses([]);
    setSelectedClass("");
    setSelectedSection("");

    setSelectedSubject("");
    setSelectedTeachers([]);

    setAllotmentMode("teacher");
    setReviewMode("teacher");

    setNotice("");
    setSaveStatus("Saved");

    // The next save-effect run (triggered by the state update above)
    // should not persist the freshly loaded data back to the store.
    isFirstRender.current = true;
  }, [project?.id]);

  // ==========================================
  // 5. DEBOUNCED AUTO-SAVE
  // ==========================================
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Cancel any lingering timer (defensive; cleanups should have run).
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timerId);
      pendingSaveRef.current = null;
    }

    const data = teacherMappings;
    const saveFn = onSaveRef.current;
    setSaveStatus("Saving…");
    const timerId = setTimeout(() => {
      pendingSaveRef.current = null;
      try {
        const result = saveFn?.(data);
        if (result && typeof result.then === "function") {
          result.then(() => setSaveStatus("Saved")).catch(() => setSaveStatus("Save failed"));
        } else {
          setSaveStatus("Saved");
        }
      } catch {
        setSaveStatus("Save failed");
      }
    }, 500);

    pendingSaveRef.current = { data, onSave: saveFn, timerId };

    return () => {
      clearTimeout(timerId);
    };
  }, [teacherMappings]);

  // Flush any pending save on unmount so navigation never loses work.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current.timerId);
        pendingSaveRef.current.onSave?.(pendingSaveRef.current.data);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  // ==========================================
  // 6. NORMALIZATION HELPERS
  // ==========================================

  function getWeeklyPeriods(classId, subjectId) {
    const mapping = classSubjectMappings.find(
      (item) => asId(item.classId) === asId(classId) && asId(item.subjectId) === asId(subjectId)
    );
    const n = Number(mapping?.periodsPerWeek);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function getSubjectWeeklyPeriods(subjectId) {
    return getWeeklyPeriods(selectedClass, subjectId);
  }

  function getSubjectCode(subjectId) {
    const subject = subjects.find((item) => asId(item.id) === asId(subjectId));
    const source = String(
      subject?.shortName || subject?.code || subject?.name || "SUB"
    ).trim();
    const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
    return (
      (words.length > 1
        ? words.map((word) => word[0]).join("")
        : source.replace(/[^A-Za-z0-9]/g, "").slice(0, 5)
      ).toUpperCase() || "SUB"
    );
  }

  // Renumber subject codes from 1 and keep quotas consistent for one group.
  function normalizeGroup(list, classId, sectionId, subjectId) {
    const groupSize = list.filter((mapping) =>
      sameGroup(mapping, classId, sectionId, subjectId)
    ).length;

    if (groupSize === 0) return list;

    const required = getWeeklyPeriods(classId, subjectId);
    const baseCode = getSubjectCode(subjectId);
    let position = 0;

    return list.map((mapping) => {
      if (!sameGroup(mapping, classId, sectionId, subjectId)) return mapping;

      position += 1;

      return {
        ...mapping,
        subjectCode: `${baseCode}-${position}`,
        periodsAllocated:
          groupSize === 1
            ? required
            : Math.max(0, Number(mapping.periodsAllocated) || 0),
      };
    });
  }

  // Bring older saved data in line (codes and quotas). Mappings that have no
  // section (very old records) are left exactly as they are.
  function normalizeAll(list) {
    // Remove malformed records and duplicate teacher-to-subject assignments
    // while preserving the first record (including its stable ID).
    const seenAssignments = new Set();
    let result = safeArray(list).filter((mapping) => {
      if (!mapping || !asId(mapping.teacherId) || !asId(mapping.classId) || !asId(mapping.subjectId)) {
        return false;
      }
      const key = `${asId(mapping.teacherId)}::${asId(mapping.classId)}::${asId(mapping.sectionId)}::${asId(mapping.subjectId)}`;
      if (seenAssignments.has(key)) return false;
      seenAssignments.add(key);
      return true;
    });

    const seenGroups = new Set();
    result.forEach((mapping) => {
      if (!mapping.sectionId) return;
      const key = `${asId(mapping.classId)}::${asId(mapping.sectionId)}::${asId(mapping.subjectId)}`;
      if (seenGroups.has(key)) return;
      seenGroups.add(key);
      result = normalizeGroup(result, mapping.classId, mapping.sectionId, mapping.subjectId);
    });

    return result;
  }

  function getGroupStatus(classId, sectionId, subjectId) {
    const group = teacherMappings.filter((mapping) =>
      sameGroup(mapping, classId, sectionId, subjectId)
    );
    const required = getWeeklyPeriods(classId, subjectId);
    const total = group.reduce(
      (sum, mapping) => sum + Math.max(0, Number(mapping.periodsAllocated) || 0),
      0
    );

    return {
      count: group.length,
      required,
      total,
      ok: group.length <= 1 || (required > 0 && total === required),
    };
  }

  function groupWarning(mapping) {
    if (!mapping.sectionId) return "";

    const status = getGroupStatus(
      mapping.classId,
      mapping.sectionId,
      mapping.subjectId
    );

    if (status.ok) return "";

    return status.required > 0
      ? `Split incomplete: ${status.total}/${status.required} periods allocated`
      : "Weekly periods not set for this subject";
  }

  function periodsLabel(mapping) {
    const warning = groupWarning(mapping);

    return (
      <>
        {mapping.periodsAllocated
          ? ` · ${mapping.periodsAllocated} periods/week`
          : ""}
        {warning && (
          <em
            style={{ color: "#b45309", fontStyle: "normal", marginLeft: 8 }}
          >
            ⚠ {warning}
          </em>
        )}
      </>
    );
  }

  // ==========================================
  // 7. NAME LOOKUPS
  // ==========================================
  function getClassName(classId) {
    return classes.find((item) => asId(item.id) === asId(classId))?.name || "Unknown class";
  }

  function getSubjectName(subjectId) {
    return (
      subjects.find((subject) => asId(subject.id) === asId(subjectId))?.name ||
      "Unknown subject"
    );
  }

    function getTeacherName(teacherId) {
    const teacher = allTeachers.find((t) => asId(t.id) === asId(teacherId));
    if (!teacher) return "Unknown teacher";
    return teacher.active === false ? `${teacher.name} (Archived)` : teacher.name;
  }

  function getSectionName(classId, sectionId) {
    if (!sectionId) return "Older assignment (no section)";

    const classData = classes.find((item) => asId(item.id) === asId(classId));

    return (
      classData?.sections?.find((section) => asId(section.id) === asId(sectionId))?.name ||
      "Unknown section"
    );
  }

  // ==========================================
  // 8. DERIVED DATA
  // ==========================================
  const selectedClassData = classes.find((item) => item.id === selectedClass);

  const sections = useMemo(
    () =>
      safeArray(selectedClassData?.sections).filter(
        (section) => section.active !== false
      ),
    [selectedClassData]
  );

  const selectedSectionData = sections.find(
    (section) => section.id === selectedSection
  );

  const availableSubjects = useMemo(
    () =>
      selectedClass
        ? subjects.filter((subject) =>
            classSubjectMappings.some(
              (mapping) =>
                asId(mapping.classId) === asId(selectedClass) &&
                mapping.subjectId === subject.id
            )
          )
        : [],
    [subjects, classSubjectMappings, selectedClass]
  );

  const selectedTeacherData = teachers.find((t) => t.id === selectedTeacher);

  const filteredTeachers = useMemo(() => {
    const q = safeName(searchTeacher).toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const name = safeName(t.name).toLowerCase();
      const initials = name.split(/\s+/).map((part) => part[0] || "").join("").toLowerCase();
      return name.includes(q) || initials.includes(q.replace(/\s+/g, ""));
    });
  }, [teachers, searchTeacher]);

  const filteredAvailableTeachers = useMemo(() => {
    const q = searchAvailableTeacher.toLowerCase();
    return teachers.filter((t) => safeName(t.name).toLowerCase().includes(q));
  }, [teachers, searchAvailableTeacher]);

  const currentTeacherAssignments = useMemo(
    () => teacherMappings.filter((m) => asId(m.teacherId) === asId(selectedTeacher)),
    [teacherMappings, selectedTeacher]
  );

  const currentSubjectAssignments = useMemo(
    () =>
      teacherMappings.filter(
        (m) =>
          asId(m.classId) === asId(selectedClass) &&
          asId(m.sectionId) === asId(selectedSection) &&
          asId(m.subjectId) === asId(selectedSubject)
      ),
    [teacherMappings, selectedClass, selectedSection, selectedSubject]
  );

  const incompleteSplits = useMemo(() => {
    const seen = new Set();
    const list = [];

    teacherMappings.forEach((mapping) => {
      if (!mapping.sectionId) return;
      if (!classes.some((c) => c.id === mapping.classId)) return;
      if (!subjects.some((s) => s.id === mapping.subjectId)) return;

      const key = `${mapping.classId}::${mapping.sectionId}::${mapping.subjectId}`;
      if (seen.has(key)) return;
      seen.add(key);

      const status = getGroupStatus(
        mapping.classId,
        mapping.sectionId,
        mapping.subjectId
      );

      if (!status.ok) {
        list.push(
          `${getClassName(mapping.classId)}-${getSectionName(
            mapping.classId,
            mapping.sectionId
          )} ${getSubjectName(mapping.subjectId)}`
        );
      }
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherMappings, classes, subjects, classSubjectMappings]);

  // ==========================================
  // 9. COMMON ASSIGNMENT
  // ==========================================
  // Add assignment with strict period-split validation. When the subject is
  // already allocated, ask how many periods the new teacher should receive;
  // those periods are transferred from the first (balance) teacher.
  function addAssignment(teacherId, classId, sectionId, subjectId, newTeacherPeriods = null) {
    const group = teacherMappings.filter((mapping) =>
      sameGroup(mapping, classId, sectionId, subjectId)
    );
    if (group.some((mapping) => asId(mapping.teacherId) === asId(teacherId))) return false;

    const required = getWeeklyPeriods(classId, subjectId);
    if (required < 1) {
      setNotice("Set this subject's weekly periods in Class-Subject Mapping before assigning it.");
      return false;
    }

    if (!group.length) {
      const newAssignment = {
        id: makeId(), teacherId: asId(teacherId), classId: asId(classId),
        sectionId: asId(sectionId), subjectId: asId(subjectId),
        subjectCode: `${getSubjectCode(subjectId)}-1`, periodsAllocated: required,
      };
      setTeacherMappings((previous) => [...previous, newAssignment]);
      return true;
    }

    const total = group.reduce((sum, mapping) => sum + (Number(mapping.periodsAllocated) || 0), 0);
    if (total !== required) {
      setNotice(`Existing allocation is inconsistent (${total}/${required}). Fix the split in Class-wise Allotment before adding another teacher.`);
      return false;
    }

    const balanceTeacher = group[0];
    const balancePeriods = Number(balanceTeacher.periodsAllocated) || 0;
    if (balancePeriods < 2) {
      setNotice(`The balance teacher (${getTeacherName(balanceTeacher.teacherId)}) must retain at least 1 period. No periods are available to transfer.`);
      return false;
    }

    const requested = Number(newTeacherPeriods);
    if (!Number.isInteger(requested) || requested < 1 || requested >= balancePeriods) {
      setNotice(`Enter a whole number from 1 to ${balancePeriods - 1}. The balance teacher must keep at least 1 period.`);
      return false;
    }

    const newAssignment = {
      id: makeId(), teacherId: asId(teacherId), classId: asId(classId),
      sectionId: asId(sectionId), subjectId: asId(subjectId),
      subjectCode: "", periodsAllocated: requested,
    };
    const next = teacherMappings.map((mapping) =>
      asId(mapping.id) === asId(balanceTeacher.id)
        ? { ...mapping, periodsAllocated: balancePeriods - requested }
        : mapping
    );
    setTeacherMappings(normalizeGroup([...next, newAssignment], classId, sectionId, subjectId));
    return true;
  }

  // ==========================================
  // 10. TEACHER-WISE ALLOTMENT
  // ==========================================
  function assignTeacherWise(subjectId, classId = selectedClass, sectionId = selectedSection) {
    if (!selectedTeacher || !classId || !sectionId) {
      setNotice("Select teacher, class and section first.");
      return false;
    }

    const group = teacherMappings.filter((mapping) => sameGroup(mapping, classId, sectionId, subjectId));
    if (group.some((mapping) => asId(mapping.teacherId) === asId(selectedTeacher))) {
      setNotice("This teacher is already assigned to this subject in this section.");
      return false;
    }

    let transferPeriods = null;
    if (group.length) {
      const required = getWeeklyPeriods(classId, subjectId);
      const currentTotal = group.reduce((sum, mapping) => sum + (Number(mapping.periodsAllocated) || 0), 0);
      const balanceTeacher = group[0];
      const available = (Number(balanceTeacher.periodsAllocated) || 0) - 1;
      if (required < 1 || currentTotal !== required || available < 1) {
        setNotice(`Cannot share yet. Existing allocation must be valid (${currentTotal}/${required}) and the balance teacher must have at least 2 periods.`);
        return false;
      }
      const answer = window.prompt(
        `${getSubjectName(subjectId)} has ${required} weekly periods.\n` +
        `${getTeacherName(balanceTeacher.teacherId)} currently has ${balanceTeacher.periodsAllocated} periods.\n` +
        `How many periods should be transferred to ${selectedTeacherData?.name}? (1–${available}; balance teacher must retain at least 1)`,
        "1"
      );
      if (answer === null) return false;
      transferPeriods = Number(answer.trim());
      if (!Number.isInteger(transferPeriods) || transferPeriods < 1 || transferPeriods > available) {
        setNotice(`Invalid period count. Enter a whole number from 1 to ${available}.`);
        return false;
      }
    }

    const added = addAssignment(selectedTeacher, classId, sectionId, subjectId, transferPeriods);
    if (!added) return false;
    setNotice(group.length
      ? `${getSubjectName(subjectId)} shared: ${transferPeriods} period(s) transferred to ${selectedTeacherData?.name}; ${getTeacherName(group[0].teacherId)} retains ${(Number(group[0].periodsAllocated) || 0) - transferPeriods}.`
      : `${getSubjectName(subjectId)} assigned to ${selectedTeacherData?.name} (${getWeeklyPeriods(classId, subjectId)} periods/week).`);
    return true;
  }

  function getActiveSectionsForClass(classId) {
    const classData = classes.find((item) => asId(item.id) === asId(classId));
    return safeArray(classData?.sections).filter(
      (section) => section && section.active !== false && asId(section.id)
    );
  }

  function toggleTeacherClass(classId) {
    const id = asId(classId);
    const exists = teacherSelectedClasses.includes(id);

    setTeacherSelectedClasses((previous) =>
      exists ? previous.filter((item) => item !== id) : [...previous, id]
    );
    setTeacherExpandedClasses((previous) =>
      exists ? previous.filter((item) => item !== id) : [...previous, id]
    );
    if (exists) {
      setTeacherSelectedSections((previous) => {
        const updated = { ...previous };
        delete updated[id];
        return updated;
      });
    }
  }

  function toggleTeacherSection(classId, sectionId) {
    const classKey = asId(classId);
    const sectionKey = asId(sectionId);
    setTeacherSelectedSections((previous) => {
      const current = safeArray(previous[classKey]);
      const next = current.includes(sectionKey)
        ? current.filter((id) => id !== sectionKey)
        : [...current, sectionKey];
      return { ...previous, [classKey]: next };
    });
  }

  function setAllTeacherSectionsForClass(classId, checked) {
    const classKey = asId(classId);
    const sectionIds = checked
      ? getActiveSectionsForClass(classKey).map((section) => asId(section.id))
      : [];
    setTeacherSelectedSections((previous) => ({ ...previous, [classKey]: sectionIds }));
  }

  function toggleTeacherClassExpanded(classId) {
    setTeacherExpandedClasses((previous) =>
      previous.includes(classId)
        ? previous.filter((id) => id !== classId)
        : [...previous, classId]
    );
  }

  function getTeacherClassSubjects(classId) {
    return subjects.filter((subject) =>
      classSubjectMappings.some(
        (mapping) =>
          asId(mapping.classId) === asId(classId) &&
          asId(mapping.subjectId) === asId(subject.id)
      )
    );
  }

  function getTeacherSubjectState(classId, sectionId, subjectId) {
    const group = teacherMappings.filter((mapping) =>
      sameGroup(mapping, classId, sectionId, subjectId)
    );
    const mine = group.some((mapping) => asId(mapping.teacherId) === asId(selectedTeacher));
    const others = group.filter((mapping) => asId(mapping.teacherId) !== asId(selectedTeacher));
    const status = getGroupStatus(classId, sectionId, subjectId);
    if (!group.length) return { label: "Not assigned", kind: "neutral", mine: false, status };
    if (mine && others.length) return { label: "Shared with other teacher(s)", kind: "shared", mine: true, status };
    if (mine && status.required > 0 && status.total >= status.required) return { label: "All weekly periods allocated", kind: "complete", mine: true, status };
    if (mine) return { label: "Assigned to this teacher", kind: "assigned", mine: true, status };
    return { label: "Assigned to another teacher", kind: "other", mine: false, status };
  }

  function bulkAssignSubjectAcrossSelectedClasses() {
    if (!selectedTeacher || !bulkSubjectId || teacherSelectedClasses.length === 0) {
      setNotice("Select a teacher, at least one class, and a subject for bulk assignment.");
      return;
    }

    const targets = teacherSelectedClasses.flatMap((classId) =>
      safeArray(teacherSelectedSections[asId(classId)]).map((sectionId) => ({
        classId: asId(classId),
        sectionId: asId(sectionId),
      }))
    );

    if (targets.length === 0) {
      setNotice("Select at least one section below the chosen class(es) before bulk assigning.");
      return;
    }

    let count = 0;
    targets.forEach(({ classId, sectionId }) => {
      const sectionIsActive = getActiveSectionsForClass(classId).some(
        (section) => asId(section.id) === sectionId
      );
      const subjectAvailable = classSubjectMappings.some(
        (mapping) => asId(mapping.classId) === classId && asId(mapping.subjectId) === asId(bulkSubjectId)
      );
      if (sectionIsActive && subjectAvailable && assignTeacherWise(bulkSubjectId, classId, sectionId)) {
        count += 1;
      }
    });
    setNotice(count
      ? `Bulk assignment completed: ${count} selected class-section assignment(s).`
      : "No new assignments were added; selected sections may already be assigned or the subject may not be mapped to those classes.");
  }

  // ==========================================
  // 11. CLASS-WISE TEACHER SELECTION
  // ==========================================
  function isTeacherAssigned(teacherId) {
    return teacherMappings.some(
      (mapping) =>
        asId(mapping.teacherId) === asId(teacherId) &&
        sameGroup(mapping, selectedClass, selectedSection, selectedSubject)
    );
  }

  // Choosing a subject loads its current teachers and quotas, so saving edits
  // the whole split instead of replacing it with only the new teachers.
  function selectSubjectForClasswise(subjectId) {
    const group = teacherMappings.filter((mapping) =>
      sameGroup(mapping, selectedClass, selectedSection, subjectId)
    );
    const required = getWeeklyPeriods(selectedClass, subjectId);

    setSelectedSubject(subjectId);
    setSelectedTeachers(group.map((mapping) => mapping.teacherId));

    setTeacherPeriodAllocations(
      Object.fromEntries(
        group.map((mapping) => {
          const existing = Number(mapping.periodsAllocated);
          const value =
            existing > 0 ? existing : group.length === 1 ? required : 1;
          return [mapping.teacherId, value];
        })
      )
    );
    setSearchAvailableTeacher("");
    setNotice("");
  }

  function toggleTeacherSelection(teacherId) {
    const required = getSubjectWeeklyPeriods(selectedSubject);

    if (selectedTeachers.some((id) => asId(id) === asId(teacherId))) {
      const remaining = selectedTeachers.filter((id) => id !== teacherId);
      setSelectedTeachers(remaining);
      setTeacherPeriodAllocations((previous) => {
        const next = { ...previous };
        delete next[teacherId];
        // If only one teacher remains, that teacher receives the full quota.
        if (remaining.length === 1 && required > 0) {
          next[remaining[0]] = required;
        }
        return next;
      });
      return;
    }

    const updated = [...selectedTeachers, teacherId];
    setSelectedTeachers(updated);
    setTeacherPeriodAllocations((previous) => {
      // The first selected teacher is the balance/anchor teacher.
      // Every additional teacher starts at 1 period; existing allocations
      // are retained and the anchor automatically receives the remainder.
      if (updated.length === 1) return { ...previous, [teacherId]: required };
      return { ...previous, [teacherId]: previous[teacherId] ?? 1 };
    });
  }

    function allocationValue(teacherId) {
    const required = getSubjectWeeklyPeriods(selectedSubject);
    if (!selectedTeachers.length || required <= 0) {
      const stored = teacherPeriodAllocations[teacherId];
      return stored === undefined || stored === null ? 1 : stored;
    }

    // First teacher is the balance teacher. Their periods are calculated
    // from the quota after preserving all later teachers' entered periods.
    if (asId(teacherId) === asId(selectedTeachers[0])) {
      const fixedTotal = selectedTeachers.slice(1).reduce((sum, id) => {
        const stored = teacherPeriodAllocations[id];
        return sum + (stored === "" || stored == null ? 0 : Number(stored) || 0);
      }, 0);
      return required - fixedTotal;
    }

    const stored = teacherPeriodAllocations[teacherId];
    return stored === undefined || stored === null ? 1 : stored;
  }

    function distributeEvenly() {
    const required = getSubjectWeeklyPeriods(selectedSubject);

    if (selectedTeachers.length < 2 || required < selectedTeachers.length) {
      setNotice(
        "Weekly periods must be at least the number of selected teachers."
      );
      return;
    }

    setTeacherPeriodAllocations(evenSplit(selectedTeachers, required));
  }

  function assignSelectedTeachers() {
    if (!selectedClass || !selectedSection || !selectedSubject) {
      setNotice("Select class, section and subject first.");
      return;
    }

    if (!selectedTeachers.length) {
      setNotice("Select at least one available teacher.");
      return;
    }

    const required = getSubjectWeeklyPeriods(selectedSubject);
    const isSplit = selectedTeachers.length > 1;

    if (isSplit && required === 0) {
      setNotice(
        "Set the weekly periods for this subject in the class-subject mapping before sharing it between teachers."
      );
      return;
    }

    const allocations = selectedTeachers.map((teacherId) =>
      Number(allocationValue(teacherId))
    );

    if (isSplit) {
      if (allocations[0] < 1) {
        setNotice("The balance teacher must retain at least 1 weekly period. Reduce another teacher's allocation.");
        return;
      }

      if (allocations.some((value) => !Number.isInteger(value) || value < 1)) {
        setNotice(
          "Give each selected teacher a whole number of weekly periods (at least 1)."
        );
        return;
      }

      const total = allocations.reduce((sum, value) => sum + value, 0);

      if (total !== required) {
        setNotice(
          `Allocated periods total ${total}. It must equal the subject's ${required} weekly periods.`
        );
        return;
      }
    }

    const existingGroup = teacherMappings.filter((mapping) =>
      sameGroup(mapping, selectedClass, selectedSection, selectedSubject)
    );

    const newGroup = selectedTeachers.map((teacherId, index) => {
      const existing = existingGroup.find(
        (mapping) => asId(mapping.teacherId) === asId(teacherId)
      );

      return {
        ...(existing || {
          id: makeId(),
          teacherId,
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: selectedSubject,
        }),
        periodsAllocated: allocations[index],
      };
    });

    const classId = selectedClass;
    const sectionId = selectedSection;
    const subjectId = selectedSubject;

    setTeacherMappings((previous) =>
      normalizeGroup(
        [
          ...previous.filter(
            (mapping) => !sameGroup(mapping, classId, sectionId, subjectId)
          ),
          ...newGroup,
        ],
        classId,
        sectionId,
        subjectId
      )
    );

    if (!isSplit) {
      setTeacherPeriodAllocations({
        [selectedTeachers[0]]: required,
      });
    }

    setNotice(
      isSplit
        ? `${getSubjectCode(subjectId)} split between ${newGroup.length} teachers. Weekly periods allocated: ${required}/${required}.`
        : `${getSubjectName(subjectId)} assigned to ${getTeacherName(
            selectedTeachers[0]
          )}.`
    );
  }

  function renderAllocationPanel() {
    const required = getSubjectWeeklyPeriods(selectedSubject);
    const single = selectedTeachers.length === 1;
    const total = selectedTeachers.reduce(
      (sum, id) => sum + Number(allocationValue(id) || 0),
      0
    );
    const balanced = single || (required > 0 && total === required);

    return (
      <div className="tm-period-allocation">
        <div className="tm-subject-heading">
          <ListChecks size={18} />
          <h3>5. Allocate Weekly Periods</h3>
        </div>

        <p className="tm-instruction">
          {required > 0 ? (
            <>
              Subject weekly periods: <strong>{required}</strong>. The first teacher is the balance teacher; later teachers' allocations stay fixed. Unique subject codes are generated automatically.
            </>
          ) : (
            <>
              Weekly periods are not set for this subject. Set them in the
              class-subject mapping before sharing it between teachers.
            </>
          )}
        </p>

        <div className="tm-period-allocation-list">
          {selectedTeachers.map((teacherId, index) => (
            <div className="tm-period-allocation-row" key={teacherId}>
              <span>
                <strong>
                  {getSubjectCode(selectedSubject)}-{index + 1}
                </strong>{" "}
                · {getTeacherName(teacherId)}
                {index === 0 ? " (Balance teacher)" : " (Fixed allocation)"}
              </span>

              <label>
                Weekly periods
                <input
                  type="number"
                  min={index === 0 ? "0" : "1"}
                  max={required > 0 ? String(required) : undefined}
                  step="1"
                  value={allocationValue(teacherId)}
                  disabled={index === 0 && required > 0}
                  onChange={(event) =>
                    setTeacherPeriodAllocations((previous) => ({
                      ...previous,
                      [teacherId]:
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          ))}
        </div>

        <p
          className="tm-instruction"
          style={balanced ? undefined : { color: "#b45309" }}
        >
          Allocated total:{" "}
          <strong>
            {total}/{required}
          </strong>
          {!balanced && required > 0 ? " — must equal the weekly periods" : ""}
          {selectedTeachers.length > 1 && Number(allocationValue(selectedTeachers[0])) < 0
            ? " — fixed allocations exceed the subject quota; reduce a later teacher's periods."
            : ""}
        </p>

        {selectedTeachers.length > 1 && required >= selectedTeachers.length && (
          <button type="button" className="assign" onClick={distributeEvenly}>
            Split evenly
          </button>
        )}
      </div>
    );
  }

  // ==========================================
  // 12. REMOVE ASSIGNMENT
  // ==========================================
  function removeAssignment(id) {
    const target = teacherMappings.find((mapping) => asId(mapping.id) === asId(id));

    if (!target) return;

    setTeacherMappings((previous) =>
      normalizeGroup(
        previous.filter((mapping) => asId(mapping.id) !== asId(id)),
        target.classId,
        target.sectionId,
        target.subjectId
      )
    );

    // Keep the class-wise selection in step when the removed teacher is in it.
    if (
      sameGroup(target, selectedClass, selectedSection, selectedSubject) &&
      selectedTeachers.some((teacherId) => asId(teacherId) === asId(target.teacherId))
    ) {
      const remaining = selectedTeachers.filter(
        (teacherId) => asId(teacherId) !== asId(target.teacherId)
      );
      const required = getWeeklyPeriods(target.classId, target.subjectId);

      setSelectedTeachers(remaining);
      setTeacherPeriodAllocations((previous) => {
        const next = { ...previous };
        delete next[target.teacherId];

        if (remaining.length === 1 && required > 0) {
          next[remaining[0]] = required;
        }

        return next;
      });
    }

    setNotice("Assignment removed successfully.");
  }

  // ==========================================
  // 13. PAGE UI
  // ==========================================
  return (
    <div className="teacher-mapping-page">
      <style>{`
        .teacher-mapping-page { width:100% !important; max-width:100% !important; min-width:0; margin:0; padding:24px !important; box-sizing:border-box; overflow-x:clip; }
        .tm-teacher-first-layout { display:grid !important; grid-template-columns:minmax(240px, 280px) minmax(0, 1fr) !important; gap:14px; align-items:start !important; width:100% !important; max-width:100% !important; min-width:0; box-sizing:border-box; }
        .tm-teacher-first-layout > .tm-panel, .tm-teacher-first-layout > .tm-teacher-workspace { min-width:0; width:100% !important; max-width:100% !important; box-sizing:border-box; align-self:start !important; }
        .tm-teacher-workspace { display:flex; flex-direction:column; align-items:stretch; justify-content:flex-start; gap:14px; min-width:0; height:fit-content; }
        .tm-teacher-workspace > .tm-assignment-panel, .tm-teacher-workspace > .tm-inline-class-subjects { width:100% !important; min-width:0; max-width:100% !important; margin:0 !important; box-sizing:border-box; }
        .tm-teacher-panel { position:relative; top:auto; max-height:calc(100vh - 100px); height:auto; overflow:auto; align-self:start; z-index:1; }
        @media (max-width:850px) {
          .teacher-mapping-page { padding:16px !important; }
          .tm-teacher-first-layout { grid-template-columns:minmax(0,1fr) !important; }
          .tm-teacher-panel { position:relative; top:auto; max-height:420px; height:auto; overflow:auto; }
        }
        .tm-class-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; }
        .tm-subject-card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px; }
        .tm-inline-class-card { border:1px solid #dbe3ef; border-radius:14px; margin:14px 0; overflow:hidden; background:#fff; }
        .tm-inline-class-header { width:100%; display:flex; align-items:center; justify-content:space-between; padding:15px 18px; background:#f8fafc; border:0; cursor:pointer; text-align:left; }
        .tm-inline-class-header span { display:flex; flex-direction:column; gap:4px; }
        .tm-inline-class-header small { color:#64748b; font-size:12px; }
        .tm-inline-class-body { padding:14px; }
        .tm-inline-section { margin-bottom:18px; }
        .tm-inline-section h3 { margin:8px 0 12px; }
        .tm-subject-status { display:block; margin:5px 0; font-size:12px; font-weight:600; }
        .tm-subject-option small { display:block; color:#64748b; margin-top:4px; font-size:11px; }
        .tm-subject-state-neutral { border-color:#e2e8f0; background:#fff; }
        .tm-subject-state-assigned { border-color:#86efac; background:#f0fdf4; }
        .tm-subject-state-complete { border-color:#22c55e; background:#ecfdf5; }
        .tm-subject-state-shared { border-color:#c4b5fd; background:#f5f3ff; }
        .tm-subject-state-other { border-color:#cbd5e1; background:#f8fafc; }
        .tm-dashboard-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin:14px 0; }
        .tm-dashboard-stats > div { display:flex; flex-direction:column; padding:12px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
        .tm-dashboard-stats strong { font-size:21px; }
        .tm-dashboard-stats span { color:#64748b; font-size:12px; }
        .tm-bulk-map-panel { border:1px dashed #cbd5e1; border-radius:12px; padding:12px; margin-top:14px; }
        .tm-bulk-actions select { padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; }
        @media(max-width:640px) { .tm-subject-card-grid { grid-template-columns:1fr; } }
      `}</style>
      {/* HEADER */}
      <div className="tm-heading">
        <div>
          <span className="tm-eyebrow">TEACHER MANAGEMENT</span>
          <h1>Teacher Mapping</h1>
          <p>
            Allocate teachers using either teacher-wise or class-wise
            selection.
          </p>
        </div>

        <div className="tm-total" aria-live="polite" title={`Auto-save status: ${saveStatus}`}>
          <span className="tm-save-status">{saveStatus}</span>
          <Users size={20} />
          <div>
            <strong>{teacherMappings.length}</strong>
            <span>Assignments</span>
          </div>
        </div>
      </div>

      {/* NOTIFICATION */}
      {notice && (
        <div className="tm-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss notice">
            <X size={16} />
          </button>
        </div>
      )}

      {incompleteSplits.length > 0 && (
        <div
          className="tm-notice"
          role="alert"
          style={{
            borderColor: "#f59e0b",
            background: "#fffbeb",
            color: "#92400e",
          }}
        >
          <span>
            {incompleteSplits.length} subject(s) have shared teachers whose
            weekly periods do not add up to the subject total:{" "}
            {incompleteSplits.slice(0, 3).join(", ")}
            {incompleteSplits.length > 3
              ? ` and ${incompleteSplits.length - 3} more`
              : ""}
            . Fix them in Class-wise Allotment.
          </span>
        </div>
      )}

      {/* VALIDATION */}
      {teachers.length === 0 ||
      classes.length === 0 ||
      subjects.length === 0 ? (
        <div className="tm-empty">
          <Users size={30} />
          <h3>Complete the previous setup first</h3>
          <p>
            Add active teachers, classes and subjects, and assign subjects to
            classes in the Subjects section.
          </p>
        </div>
      ) : (
        <>
          {/* ALLOTMENT MODE SELECTOR */}
          <section className="tm-panel tm-mode-panel">
            <div className="tm-panel-heading">
              <ListChecks size={19} />
              <h2>Select Allotment Method</h2>
            </div>

            <div className="tm-mode-options">
              <button
                className={`tm-mode-option ${
                  allotmentMode === "teacher" ? "active" : ""
                }`}
                onClick={() => {
                  setAllotmentMode("teacher");
                  setSelectedTeacher("");
                  setTeacherSelectedClasses([]);
                  setTeacherSelectedSections({});
                  setTeacherExpandedClasses([]);
                  setSelectedClass("");
                  setSelectedSection("");
                  setSelectedSubject("");
                  setSelectedTeachers([]);
                  setTeacherPeriodAllocations({});
                  setNotice("");
                }}
              >
                <UserRound size={23} />
                <div>
                  <strong>Teacher-wise Allotment</strong>
                  <span>
                    Select a teacher first, then assign classes, sections and
                    subjects.
                  </span>
                </div>
                {allotmentMode === "teacher" && <Check size={19} />}
              </button>

              <button
                className={`tm-mode-option ${
                  allotmentMode === "class" ? "active" : ""
                }`}
                onClick={() => {
                  setAllotmentMode("class");
                  setSelectedTeacher("");
                  setTeacherSelectedClasses([]);
                  setTeacherSelectedSections({});
                  setTeacherExpandedClasses([]);
                  setSelectedClass("");
                  setSelectedSection("");
                  setSelectedSubject("");
                  setSelectedTeachers([]);
                  setTeacherPeriodAllocations({});
                  setNotice("");
                }}
              >
                <GraduationCap size={23} />
                <div>
                  <strong>Class-wise Allotment</strong>
                  <span>
                    Select a class, section and subject, then choose available
                    teachers.
                  </span>
                </div>
                {allotmentMode === "class" && <Check size={19} />}
              </button>
            </div>
          </section>

          {/* OPTION 1: TEACHER-FIRST MULTI-CLASS WORKFLOW */}
          {allotmentMode === "teacher" && (
            <div className="tm-layout tm-teacher-first-layout">
              <section className="tm-panel tm-teacher-panel">
                <div className="tm-panel-heading">
                  <UserRound size={19} />
                  <h2>Step 1 · Select Teacher</h2>
                </div>
                <div className="tm-search">
                  <Search size={17} />
                  <input
                    value={searchTeacher}
                    onChange={(event) => setSearchTeacher(event.target.value)}
                    placeholder="Search by name or initials..."
                  />
                </div>
                <div className="tm-teacher-list">
                  {filteredTeachers.map((teacher) => {
                    const workload = teacherMappings
                      .filter((m) => asId(m.teacherId) === asId(teacher.id))
                      .reduce((sum, m) => sum + (Number(m.periodsAllocated) || 0), 0);
                    return (
                      <button
                        key={teacher.id}
                        className={`tm-teacher-option ${selectedTeacher === teacher.id ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedTeacher(teacher.id);
                          setTeacherSelectedClasses([]);
                          setTeacherSelectedSections({});
                          setTeacherExpandedClasses([]);
                          setBulkSubjectId("");
                          setSelectedClass("");
                          setSelectedSection("");
                          setSelectedSubject("");
                          setSelectedTeachers([]);
                          setTeacherPeriodAllocations({});
                          setNotice("");
                        }}
                      >
                        <span className="tm-avatar">{safeName(teacher.name).charAt(0).toUpperCase()}</span>
                        <span className="tm-teacher-name">{teacher.name}</span>
                        <span className="tm-muted">{workload} periods</span>
                        {selectedTeacher === teacher.id && <Check size={18} />}
                      </button>
                    );
                  })}
                  {filteredTeachers.length === 0 && <p className="tm-muted">No teachers found.</p>}
                </div>
              </section>

              <div className="tm-teacher-workspace">
              <section className="tm-panel tm-assignment-panel">
                <div className="tm-panel-heading">
                  <GraduationCap size={19} />
                  <h2>Step 2 · Select Classes</h2>
                </div>
                {!selectedTeacher ? (
                  <p className="tm-instruction">Select a teacher to continue.</p>
                ) : (
                  <>
                    <div className="tm-selected-teacher">
                      <span className="tm-avatar">{safeName(selectedTeacherData?.name).charAt(0).toUpperCase()}</span>
                      <div><strong>{selectedTeacherData?.name}</strong><span>Selected teacher</span></div>
                    </div>
                    <div className="tm-bulk-actions">
                      <button type="button" className="assign" onClick={() => {
                        setTeacherSelectedClasses(classes.map((item) => asId(item.id)));
                        setTeacherSelectedSections({});
                        setTeacherExpandedClasses(classes.map((item) => asId(item.id)));
                      }}>Select All Classes</button>
                      <button type="button" className="tm-remove" onClick={() => {
                        setTeacherSelectedClasses([]);
                        setTeacherSelectedSections({});
                        setTeacherExpandedClasses([]);
                      }}>Clear All</button>
                      <button type="button" className="assign" onClick={() => setTeacherExpandedClasses(teacherSelectedClasses)}>
                        Expand All
                      </button>
                      <button type="button" className="tm-remove" onClick={() => setTeacherExpandedClasses([])}>
                        Collapse All
                      </button>
                    </div>
                    <div className="tm-class-list tm-class-grid">
                      {classes.map((item) => (
                        <button
                          key={item.id}
                          className={`tm-class-option ${teacherSelectedClasses.includes(asId(item.id)) ? "selected" : ""}`}
                          onClick={() => toggleTeacherClass(asId(item.id))}
                        >
                          <GraduationCap size={17} />
                          <span>{item.name}</span>
                          {teacherSelectedClasses.includes(asId(item.id)) ? <Check size={17} /> : null}
                        </button>
                      ))}
                    </div>

                    {teacherSelectedClasses.length > 0 && (
                      <div className="tm-section-selection-panel">
                        <div className="tm-subject-heading"><GraduationCap size={18}/><h3>Select Sections</h3></div>
                        <p className="tm-instruction">Choose the exact sections this teacher handles. Only checked sections will appear for subject mapping or Bulk Assign.</p>
                        {teacherSelectedClasses.map((classId) => {
                          const classData = classes.find((item) => asId(item.id) === asId(classId));
                          const activeSections = getActiveSectionsForClass(classId);
                          const selectedIds = safeArray(teacherSelectedSections[asId(classId)]);
                          const allSelected = activeSections.length > 0 && activeSections.every((section) => selectedIds.includes(asId(section.id)));
                          return (
                            <div className="tm-section-selection-class" key={classId}>
                              <div className="tm-section-selection-heading">
                                <strong>{classData?.name || "Class"}</strong>
                                <span>{selectedIds.length} / {activeSections.length} selected</span>
                                <button type="button" className="assign" onClick={() => setAllTeacherSectionsForClass(classId, !allSelected)}>
                                  {allSelected ? "Clear Sections" : "Select All Sections"}
                                </button>
                              </div>
                              {activeSections.length === 0 ? (
                                <p className="tm-instruction">No active sections configured for this class.</p>
                              ) : (
                                <div className="tm-section-choice-list">
                                  {activeSections.map((section) => {
                                    const sectionId = asId(section.id);
                                    const checked = selectedIds.includes(sectionId);
                                    return (
                                      <label className={`tm-section-choice ${checked ? "selected" : ""}`} key={sectionId}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleTeacherSection(classId, sectionId)} />
                                        <span>Section {section.name}</span>
                                        {checked && <Check size={16}/>}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {teacherSelectedClasses.length > 0 && (
                      <div className="tm-bulk-map-panel">
                        <div className="tm-subject-heading"><Copy size={18}/><h3>Bulk Assign</h3></div>
                        <p className="tm-instruction">Assign a subject only to the checked class-section combinations.</p>
                        <div className="tm-bulk-actions">
                          <select value={bulkSubjectId} onChange={(e) => setBulkSubjectId(e.target.value)}>
                            <option value="">Choose subject...</option>
                            {subjects.map((subject) => <option key={subject.id} value={asId(subject.id)}>{subject.name}</option>)}
                          </select>
                          <button type="button" className="assign" onClick={bulkAssignSubjectAcrossSelectedClasses}>Assign to Selected Sections</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {selectedTeacher && teacherSelectedClasses.length > 0 && (
                <section className="tm-panel tm-inline-class-subjects">
                  <div className="tm-panel-heading">
                    <BookOpen size={19}/>
                    <h2>Step 3 · Assign Subjects Inline</h2>
                  </div>
                  <div className="tm-dashboard-stats">
                    <div><strong>{teacherSelectedClasses.reduce((sum, classId) => sum + safeArray(teacherSelectedSections[asId(classId)]).length, 0)}</strong><span>Sections selected</span></div>
                    <div><strong>{currentTeacherAssignments.length}</strong><span>Subject mappings</span></div>
                    <div><strong>{currentTeacherAssignments.reduce((sum, m) => sum + (Number(m.periodsAllocated) || 0), 0)}</strong><span>Periods/week assigned</span></div>
                    <div><strong>{incompleteSplits.length}</strong><span>Shared splits needing review</span></div>
                  </div>

                  {teacherSelectedClasses.map((classId) => {
                    const classData = classes.find((item) => asId(item.id) === asId(classId));
                    const activeSections = getActiveSectionsForClass(classId).filter((section) => safeArray(teacherSelectedSections[asId(classId)]).includes(asId(section.id)));
                    const classSubjects = getTeacherClassSubjects(classId);
                    const expanded = teacherExpandedClasses.includes(classId);
                    return (
                      <div className="tm-inline-class-card" key={classId}>
                        <button type="button" className="tm-inline-class-header" onClick={() => toggleTeacherClassExpanded(classId)}>
                          <span><strong>{classData?.name || "Class"}</strong><small>{classSubjects.length} subjects · {activeSections.length} selected section(s)</small></span>
                          {expanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </button>
                        {expanded && (
                          <div className="tm-inline-class-body">
                            {activeSections.length === 0 ? <p className="tm-instruction">No active sections found for this class.</p> :
                              activeSections.map((section) => (
                                <div className="tm-inline-section" key={section.id}>
                                  <h3>Section {section.name}</h3>
                                  <div className="tm-subject-list tm-subject-card-grid">
                                    {classSubjects.map((subject) => {
                                      const state = getTeacherSubjectState(classId, asId(section.id), asId(subject.id));
                                      const own = teacherMappings.find((m) => asId(m.teacherId) === asId(selectedTeacher) && sameGroup(m, classId, asId(section.id), asId(subject.id)));
                                      const sharedNames = teacherMappings.filter((m) => sameGroup(m, classId, asId(section.id), asId(subject.id))).map((m) => getTeacherName(m.teacherId));
                                      return (
                                        <div className={`tm-subject-option tm-subject-state-${state.kind}`} key={subject.id}>
                                          <div>
                                            <strong>{subject.name}</strong>
                                            <span className="tm-subject-status">{state.label}</span>
                                            <small>{state.status.total}/{state.status.required || "—"} periods allocated</small>
                                            {state.kind === "shared" && <small>Shared: {sharedNames.join(", ")}</small>}
                                            {state.kind === "neutral" && state.status.required > 0 && <small>{state.status.required} weekly periods available</small>}
                                          </div>
                                          {own ? (
                                            <button type="button" className="tm-remove" onClick={() => {
                                              if (window.confirm(`Remove ${subject.name} from ${selectedTeacherData?.name} for ${classData?.name} Section ${section.name}?`)) removeAssignment(own.id);
                                            }}><Trash2 size={15}/> Remove</button>
                                          ) : (
                                            <button type="button" className="assign" onClick={() => assignTeacherWise(asId(subject.id), classId, asId(section.id))} disabled={state.mine || (state.kind === "complete" && !state.mine)}>
                                              <UserPlus size={15}/> Assign
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
              </div>
            </div>
          )}

          {/* OPTION 2: CLASS-WISE */}
          {allotmentMode === "class" && (
            <section className="tm-panel tm-classwise-panel">
              <div className="tm-panel-heading">
                <GraduationCap size={19} />
                <h2>Class-wise Teacher Allotment</h2>
              </div>

              <p className="tm-instruction">
                Select a class, section and subject. Select teachers in order: the first becomes the balance teacher; period allocations entered for later teachers are preserved.
              </p>

              {/* CLASS SELECTION */}
              <div className="tm-classwise-step">
                <h3>1. Select Class</h3>

                <div className="tm-class-list">
                  {classes.map((item) => (
                    <button
                      key={item.id}
                      className={`tm-class-option ${
                        selectedClass === item.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedClass(item.id);
                        setSelectedSection("");
                        setSelectedSubject("");
                        setSelectedTeachers([]);
                        setTeacherPeriodAllocations({});
                        setNotice("");
                      }}
                    >
                      <GraduationCap size={17} />
                      <span>{item.name}</span>
                      {selectedClass === item.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION SELECTION */}
              {selectedClass && (
                <div className="tm-classwise-step">
                  <h3>2. Select Section</h3>

                  {sections.length === 0 ? (
                    <p className="tm-instruction">
                      No active sections available.
                    </p>
                  ) : (
                    <div className="tm-class-list">
                      {sections.map((section) => (
                        <button
                          key={section.id}
                          className={`tm-class-option ${
                            selectedSection === section.id ? "selected" : ""
                          }`}
                          onClick={() => {
                            setSelectedSection(section.id);
                            setSelectedSubject("");
                            setSelectedTeachers([]);
                            setTeacherPeriodAllocations({});
                            setNotice("");
                          }}
                        >
                          <GraduationCap size={17} />
                          <span>{section.name}</span>
                          {selectedSection === section.id && (
                            <Check size={17} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUBJECT SELECTION */}
              {selectedClass && selectedSection && (
                <div className="tm-classwise-step">
                  <h3>3. Select Subject</h3>

                  {availableSubjects.length === 0 ? (
                    <p className="tm-instruction">
                      No subjects are mapped to this class.
                    </p>
                  ) : (
                    <div className="tm-subject-list">
                      {availableSubjects.map((subject) => (
                        <button
                          key={subject.id}
                          className={`tm-class-option ${
                            selectedSubject === subject.id ? "selected" : ""
                          }`}
                          onClick={() => selectSubjectForClasswise(subject.id)}
                        >
                          <BookOpen size={17} />
                          <span>{subject.name}</span>
                          {selectedSubject === subject.id && (
                            <Check size={17} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TEACHER SELECTION */}
              {selectedClass && selectedSection && selectedSubject && (
                <div className="tm-classwise-step">
                  <div className="tm-subject-heading">
                    <UserPlus size={19} />
                    <h3>4. Select Available Teachers</h3>
                  </div>

                  <p className="tm-instruction">
                    {getSubjectName(selectedSubject)} —{" "}
                    {getClassName(selectedClass)} - {selectedSectionData?.name}
                  </p>

                  {/* ALREADY ASSIGNED TEACHERS */}
                  {currentSubjectAssignments.length > 0 && (
                    <div className="tm-currently-assigned">
                      <strong>Saved teachers for this subject</strong>

                      <div className="tm-assigned-teacher-list">
                        {currentSubjectAssignments.map((mapping) => (
                          <div
                            className="tm-assigned-teacher"
                            key={mapping.id}
                          >
                            <span>
                              {getTeacherName(mapping.teacherId)}
                              {periodsLabel(mapping)}
                            </span>

                            <span className="tm-assigned-label">Assigned</span>

                            <button
                              className="tm-remove"
                              onClick={() => removeAssignment(mapping.id)}
                              title="Remove assignment"
                            >
                              <Trash2 size={15} />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEARCH AVAILABLE TEACHERS */}
                  <div className="tm-search">
                    <Search size={17} />
                    <input
                      value={searchAvailableTeacher}
                      onChange={(event) =>
                        setSearchAvailableTeacher(event.target.value)
                      }
                      placeholder="Search available teachers..."
                    />
                  </div>

                  {/* TEACHER CHECKBOXES */}
                  <div className="tm-available-teachers">
                    {filteredAvailableTeachers.map((teacher) => {
                      const assigned = isTeacherAssigned(teacher.id);
                      const checked = selectedTeachers.includes(teacher.id);

                      return (
                        <label
                          className="tm-available-teacher"
                          key={teacher.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTeacherSelection(teacher.id)}
                          />

                          <span className="tm-avatar">
                            {safeName(teacher.name).charAt(0).toUpperCase()}
                          </span>

                          <span className="tm-teacher-name">{teacher.name}</span>

                          {assigned ? (
                            <span className="tm-assigned-label">Assigned</span>
                          ) : (
                            <span className="tm-available-label">
                              Available
                            </span>
                          )}
                        </label>
                      );
                    })}

                    {filteredAvailableTeachers.length === 0 && (
                      <p className="tm-muted">No teachers found.</p>
                    )}
                  </div>

                  {selectedTeachers.length > 0 && renderAllocationPanel()}

                  {/* ASSIGN BUTTON */}
                  <div className="tm-bulk-actions">
                    <span>
                      {selectedTeachers.length} teacher(s) selected
                    </span>

                    <button
                      className="assign"
                      disabled={selectedTeachers.length === 0}
                      onClick={assignSelectedTeachers}
                    >
                      <UserPlus size={16} />
                      Save Assignment
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ASSIGNMENT REVIEW */}
      <section className="tm-panel tm-review-panel">
        <div className="tm-panel-heading">
          <BookOpen size={19} />
          <h2>Review Teacher Assignments</h2>
        </div>

        <div className="tm-review-tabs">
          <button
            className={reviewMode === "teacher" ? "active" : ""}
            onClick={() => setReviewMode("teacher")}
          >
            Teacher-wise
          </button>

          <button
            className={reviewMode === "class" ? "active" : ""}
            onClick={() => setReviewMode("class")}
          >
            Class-wise
          </button>
        </div>

        {/* TEACHER-WISE REVIEW */}
        {reviewMode === "teacher" ? (
          <>
            {!selectedTeacher ? (
              <p className="tm-instruction">
                Select a teacher in Teacher-wise Allotment to view their
                assignments.
              </p>
            ) : currentTeacherAssignments.length === 0 ? (
              <p className="tm-instruction">
                No subjects assigned to {selectedTeacherData?.name}.
              </p>
            ) : (
              <div className="tm-review-list">
                {currentTeacherAssignments.map((mapping) => (
                  <div className="tm-review-item" key={mapping.id}>
                    <div>
                      <strong>{getClassName(mapping.classId)}</strong>
                      <span>
                        {getSectionName(mapping.classId, mapping.sectionId)}
                        {" • "}
                        {getSubjectName(mapping.subjectId)}{" "}
                        {mapping.subjectCode
                          ? `(${mapping.subjectCode})`
                          : ""}
                        {periodsLabel(mapping)}
                      </span>
                    </div>

                    <button
                      className="tm-remove"
                      onClick={() => removeAssignment(mapping.id)}
                    >
                      <Trash2 size={17} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* CLASS-WISE REVIEW */
          <>
            {classes.map((item) => {
              const classAssignments = teacherMappings.filter(
                (mapping) => asId(mapping.classId) === asId(item.id)
              );

              const activeSections = safeArray(item.sections).filter(
                (section) => section.active !== false
              );

              const legacyAssignments = classAssignments.filter(
                (mapping) => !mapping.sectionId
              );

              return (
                <div className="tm-class-review" key={item.id}>
                  <h3>{item.name}</h3>

                  {activeSections.map((section) => {
                    const sectionAssignments = classAssignments.filter(
                      (mapping) => asId(mapping.sectionId) === asId(section.id)
                    );

                    return (
                      <div className="tm-section-review" key={section.id}>
                        <h4>Section {section.name}</h4>

                        {sectionAssignments.length === 0 ? (
                          <p className="tm-instruction">
                            No teachers assigned yet.
                          </p>
                        ) : (
                          <div className="tm-review-list">
                            {sectionAssignments.map((mapping) => (
                              <div className="tm-review-item" key={mapping.id}>
                                <div>
                                  <strong>
                                    {getSubjectName(mapping.subjectId)}{" "}
                                    {mapping.subjectCode
                                      ? `(${mapping.subjectCode})`
                                      : ""}
                                  </strong>
                                  <span>
                                    {getTeacherName(mapping.teacherId)}
                                    {periodsLabel(mapping)}
                                  </span>
                                </div>

                                <button
                                  className="tm-remove"
                                  onClick={() => removeAssignment(mapping.id)}
                                >
                                  <Trash2 size={17} />
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* LEGACY ASSIGNMENTS */}
                  {legacyAssignments.length > 0 && (
                    <div className="tm-section-review">
                      <h4>Older assignments without sections</h4>

                      <p className="tm-instruction">
                        These records were created before section-wise
                        allotment. They have been preserved.
                      </p>

                      <div className="tm-review-list">
                        {legacyAssignments.map((mapping) => (
                          <div className="tm-review-item" key={mapping.id}>
                            <div>
                              <strong>
                                {getSubjectName(mapping.subjectId)}{" "}
                                {mapping.subjectCode
                                  ? `(${mapping.subjectCode})`
                                  : ""}
                              </strong>
                              <span>
                                {getTeacherName(mapping.teacherId)}
                                {periodsLabel(mapping)}
                              </span>
                            </div>

                            <button
                              className="tm-remove"
                              onClick={() => removeAssignment(mapping.id)}
                            >
                              <Trash2 size={17} />
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginTop: "20px",
        }}
      >
        <div className="tm-save-status" style={{ margin: 0 }}>
          <Check size={16} />
          Changes are saved automatically to this school project.
        </div>

        <button
          type="button"
          onClick={() => onContinue?.()}
          style={{
            padding: "12px 22px",
            border: "none",
            borderRadius: "8px",
            background: "#4f46e5",
            color: "#fff",
            fontSize: "14px",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
          }}
        >
          Next: Timetable Builder →
        </button>
      </div>
    </div>
  );
}