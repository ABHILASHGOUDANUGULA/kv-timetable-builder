
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

import "../styles/teacher-mapping.css";

// Two mappings belong to the same "split group" when they share class, section and subject.
function sameGroup(mapping, classId, sectionId, subjectId) {
  return (
    mapping.classId === classId &&
    mapping.sectionId === sectionId &&
    mapping.subjectId === subjectId
  );
}

// Divide `required` weekly periods as evenly as possible among teacher ids.
function evenSplit(teacherIds, required) {
  const base = Math.floor(required / teacherIds.length);
  let extra = required % teacherIds.length;
  const result = {};
  teacherIds.forEach((id) => {
    result[id] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
  });
  return result;
}

export default function TeacherMapping({ project, onSave }) {
  // ==========================================
  // 1. PROJECT DATA
  // ==========================================

  const teachers = (project?.data?.teachers || []).filter(
    (teacher) => teacher.active !== false
  );

  const classes = (project?.data?.classes || []).filter(
    (item) => item.active !== false
  );

  const subjects = (project?.data?.subjects || []).filter(
    (subject) => subject.active !== false
  );

  const classSubjectMappings = project?.data?.mappings || [];

  // ==========================================
  // 2. STATES
  // ==========================================

  const [teacherMappings, setTeacherMappings] = useState(
    () => normalizeAll(project?.data?.teacherMappings || [])
  );

  const [allotmentMode, setAllotmentMode] = useState("teacher");

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Class-wise selection
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [teacherPeriodAllocations, setTeacherPeriodAllocations] = useState({});

  const [searchTeacher, setSearchTeacher] = useState("");
  const [searchAvailableTeacher, setSearchAvailableTeacher] =
    useState("");

  const [reviewMode, setReviewMode] = useState("teacher");
  const [notice, setNotice] = useState("");

  const onSaveRef = useRef(onSave);
  const isFirstRender = useRef(true);

  // ==========================================
  // 3. SELECTED CLASS AND SECTIONS
  // ==========================================

  const selectedClassData = classes.find(
    (item) => item.id === selectedClass
  );

  const sections = (selectedClassData?.sections || []).filter(
    (section) => section.active !== false
  );

  const selectedSectionData = sections.find(
    (section) => section.id === selectedSection
  );

  // ==========================================
  // 4. SAVE AND PROJECT SWITCHING
  // ==========================================

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    setTeacherMappings(normalizeAll(project?.data?.teacherMappings || []));
    setTeacherPeriodAllocations({});

    setSelectedTeacher("");
    setSelectedClass("");
    setSelectedSection("");

    setSelectedSubject("");
    setSelectedTeachers([]);

    setAllotmentMode("teacher");
    setReviewMode("teacher");

    setNotice("");
  }, [project?.id]);

  // Automatically save assignment changes.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      onSaveRef.current?.(teacherMappings);
    }, 500);

    return () => clearTimeout(timer);
  }, [teacherMappings]);

  // ==========================================
  // 5. COMMON HELPER FUNCTIONS
  // ==========================================

  function getClassName(classId) {
    return (
      classes.find((item) => item.id === classId)?.name ||
      "Unknown class"
    );
  }

  function getSubjectName(subjectId) {
    return (
      subjects.find((subject) => subject.id === subjectId)?.name ||
      "Unknown subject"
    );
  }

  function getTeacherName(teacherId) {
    return (
      teachers.find((teacher) => teacher.id === teacherId)?.name ||
      "Unknown teacher"
    );
  }

  function getSectionName(classId, sectionId) {
    if (!sectionId) {
      return "Older assignment (no section)";
    }

    const classData = classes.find(
      (item) => item.id === classId
    );

    return (
      classData?.sections?.find(
        (section) => section.id === sectionId
      )?.name || "Unknown section"
    );
  }

  // Subjects assigned to the selected class.
  const availableSubjects = subjects.filter((subject) =>
    classSubjectMappings.some(
      (mapping) =>
        mapping.classId === selectedClass &&
        mapping.subjectId === subject.id
    )
  );

  const selectedTeacherData = teachers.find(
    (teacher) => teacher.id === selectedTeacher
  );

  const filteredTeachers = teachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(searchTeacher.toLowerCase())
  );

  const filteredAvailableTeachers = teachers.filter((teacher) =>
    teacher.name
      .toLowerCase()
      .includes(searchAvailableTeacher.toLowerCase())
  );

  // ==========================================
  // 6. COMMON ASSIGNMENT FUNCTION
  // ==========================================

  // ==========================================
  // 6. SPLIT-GROUP HELPERS
  // ==========================================
  // A "group" is every teacher mapped to one subject in one class section.
  // Each mapping carries a subject code (MATH-1, MATH-2 ...) and the weekly
  // periods that teacher takes. A lone teacher always takes all periods.

  function getWeeklyPeriods(classId, subjectId) {
    const mapping = classSubjectMappings.find(
      (item) => item.classId === classId && item.subjectId === subjectId
    );
    return Number(mapping?.periodsPerWeek || 0);
  }

  function getSubjectWeeklyPeriods(subjectId) {
    return getWeeklyPeriods(selectedClass, subjectId);
  }

  function getSubjectCode(subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    const source = String(subject?.shortName || subject?.code || subject?.name || "SUB").trim();
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
          groupSize === 1 ? required : Number(mapping.periodsAllocated || 0),
      };
    });
  }

  // Bring older saved data in line (codes and quotas). Mappings that have no
  // section (very old records) are left exactly as they are.
  function normalizeAll(list) {
    const seen = new Set();
    let result = list;

    list.forEach((mapping) => {
      if (!mapping.sectionId) return;

      const key = `${mapping.classId}::${mapping.sectionId}::${mapping.subjectId}`;
      if (seen.has(key)) return;
      seen.add(key);

      result = normalizeGroup(
        result,
        mapping.classId,
        mapping.sectionId,
        mapping.subjectId
      );
    });

    return result;
  }

  function getGroupStatus(classId, sectionId, subjectId) {
    const group = teacherMappings.filter((mapping) =>
      sameGroup(mapping, classId, sectionId, subjectId)
    );
    const required = getWeeklyPeriods(classId, subjectId);
    const total = group.reduce(
      (sum, mapping) => sum + Number(mapping.periodsAllocated || 0),
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
          <em style={{ color: "#b45309", fontStyle: "normal", marginLeft: 8 }}>
            ⚠ {warning}
          </em>
        )}
      </>
    );
  }

  // ==========================================
  // 7. COMMON ASSIGNMENT FUNCTION
  // ==========================================

  function addAssignment(teacherId, classId, sectionId, subjectId) {
    const alreadyAssigned = teacherMappings.some(
      (mapping) =>
        mapping.teacherId === teacherId &&
        sameGroup(mapping, classId, sectionId, subjectId)
    );

    if (alreadyAssigned) {
      return false;
    }

    const newAssignment = {
      id: crypto.randomUUID(),
      teacherId,
      classId,
      sectionId,
      subjectId,
      subjectCode: "",
      periodsAllocated: 0,
    };

    setTeacherMappings((previous) =>
      previous.some(
        (mapping) =>
          mapping.teacherId === teacherId &&
          sameGroup(mapping, classId, sectionId, subjectId)
      )
        ? previous
        : normalizeGroup(
            [...previous, newAssignment],
            classId,
            sectionId,
            subjectId
          )
    );

    return true;
  }

  // ==========================================
  // 8. TEACHER-WISE ALLOTMENT
  // ==========================================

  function assignTeacherWise(subjectId) {
    if (!selectedTeacher || !selectedClass || !selectedSection) {
      setNotice("Select teacher, class and section first.");
      return;
    }

    const hadOtherTeachers = teacherMappings.some((mapping) =>
      sameGroup(mapping, selectedClass, selectedSection, subjectId)
    );

    const added = addAssignment(
      selectedTeacher,
      selectedClass,
      selectedSection,
      subjectId
    );

    if (!added) {
      setNotice(
        "This teacher is already assigned to this subject in this section."
      );
      return;
    }

    setNotice(
      `${getSubjectName(subjectId)} assigned to ${selectedTeacherData?.name}.` +
        (hadOtherTeachers
          ? " This subject now has more than one teacher. Open Class-wise Allotment to split its weekly periods."
          : "")
    );
  }

  // ==========================================
  // 9. CLASS-WISE TEACHER SELECTION
  // ==========================================

  function isTeacherAssigned(teacherId) {
    return teacherMappings.some(
      (mapping) =>
        mapping.teacherId === teacherId &&
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
        group.map((mapping) => [
          mapping.teacherId,
          Number(mapping.periodsAllocated) ||
            (group.length === 1 ? required : 1) ||
            1,
        ])
      )
    );
    setSearchAvailableTeacher("");
    setNotice("");
  }

  function toggleTeacherSelection(teacherId) {
    const required = getSubjectWeeklyPeriods(selectedSubject);

    if (selectedTeachers.includes(teacherId)) {
      const remaining = selectedTeachers.filter((id) => id !== teacherId);

      setSelectedTeachers(remaining);
      setTeacherPeriodAllocations((previous) => {
        const next = { ...previous };
        delete next[teacherId];

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
      if (updated.length === 1) {
        return { ...previous, [teacherId]: required || 1 };
      }

      return required >= updated.length
        ? evenSplit(updated, required)
        : { ...previous, [teacherId]: 1 };
    });
  }

  function allocationValue(teacherId) {
    const required = getSubjectWeeklyPeriods(selectedSubject);

    if (selectedTeachers.length === 1 && required > 0) {
      return required;
    }

    return teacherPeriodAllocations[teacherId] ?? 1;
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
      if (allocations.some((value) => !Number.isInteger(value) || value < 1)) {
        setNotice("Give each selected teacher a whole number of weekly periods (at least 1).");
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
        (mapping) => mapping.teacherId === teacherId
      );

      return {
        ...(existing || {
          id: crypto.randomUUID(),
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
        [selectedTeachers[0]]: required || 1,
      });
    }

    setNotice(
      isSplit
        ? `${getSubjectCode(subjectId)} split between ${newGroup.length} teachers. Weekly periods allocated: ${required}/${required}.`
        : `${getSubjectName(subjectId)} assigned to ${getTeacherName(selectedTeachers[0])}.`
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
          <h3>5. Split Weekly Periods Across Teachers</h3>
        </div>

        <p className="tm-instruction">
          {required > 0 ? (
            <>
              Subject weekly periods: <strong>{required}</strong>. Subject
              codes are generated automatically.
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
              </span>

              <label>
                Weekly periods
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={allocationValue(teacherId)}
                  disabled={single && required > 0}
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
  // 10. REMOVE ASSIGNMENT
  // ==========================================

  function removeAssignment(id) {
    const target = teacherMappings.find((mapping) => mapping.id === id);

    if (!target) return;

    setTeacherMappings((previous) =>
      normalizeGroup(
        previous.filter((mapping) => mapping.id !== id),
        target.classId,
        target.sectionId,
        target.subjectId
      )
    );

    // Keep the class-wise selection in step when the removed teacher is in it.
    if (
      sameGroup(target, selectedClass, selectedSection, selectedSubject) &&
      selectedTeachers.includes(target.teacherId)
    ) {
      const remaining = selectedTeachers.filter(
        (teacherId) => teacherId !== target.teacherId
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
  // 10. ASSIGNMENT FILTERS
  // ==========================================

  const currentTeacherAssignments = teacherMappings.filter(
    (mapping) => mapping.teacherId === selectedTeacher
  );

  const currentSubjectAssignments = teacherMappings.filter(
    (mapping) =>
      mapping.classId === selectedClass &&
      mapping.sectionId === selectedSection &&
      mapping.subjectId === selectedSubject
  );

  const incompleteSplits = (() => {
    const seen = new Set();
    const list = [];

    teacherMappings.forEach((mapping) => {
      if (!mapping.sectionId) return;
      if (!classes.some((item) => item.id === mapping.classId)) return;
      if (!subjects.some((item) => item.id === mapping.subjectId)) return;

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
  })();

  // ==========================================
  // 11. PAGE UI
  // ==========================================

  return (
    <div className="teacher-mapping-page">

      {/* HEADER */}

      <div className="tm-heading">
        <div>
          <span className="tm-eyebrow">
            TEACHER MANAGEMENT
          </span>

          <h1>Teacher Mapping</h1>

          <p>
            Allocate teachers using either teacher-wise or class-wise
            selection.
          </p>
        </div>

        <div className="tm-total">
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

          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {incompleteSplits.length > 0 && (
        <div
          className="tm-notice"
          role="alert"
          style={{ borderColor: "#f59e0b", background: "#fffbeb", color: "#92400e" }}
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
            Add active teachers, classes and subjects, and assign
            subjects to classes in the Subjects section.
          </p>
        </div>

      ) : (

        <>

          {/* =================================
              ALLOTMENT MODE SELECTOR
          ================================= */}

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
                  setSelectedClass("");
                  setSelectedSection("");
                  setSelectedSubject("");
                  setSelectedTeachers([]);
                  setNotice("");
                }}
              >
                <UserRound size={23} />

                <div>
                  <strong>Teacher-wise Allotment</strong>
                  <span>
                    Select a teacher first, then assign classes,
                    sections and subjects.
                  </span>
                </div>

                {allotmentMode === "teacher" && (
                  <Check size={19} />
                )}
              </button>

              <button
                className={`tm-mode-option ${
                  allotmentMode === "class" ? "active" : ""
                }`}
                onClick={() => {
                  setAllotmentMode("class");
                  setSelectedTeacher("");
                  setSelectedClass("");
                  setSelectedSection("");
                  setSelectedSubject("");
                  setSelectedTeachers([]);
                  setNotice("");
                }}
              >
                <GraduationCap size={23} />

                <div>
                  <strong>Class-wise Allotment</strong>
                  <span>
                    Select a class, section and subject, then
                    choose available teachers.
                  </span>
                </div>

                {allotmentMode === "class" && (
                  <Check size={19} />
                )}
              </button>

            </div>

          </section>

          {/* =================================
              OPTION 1: TEACHER-WISE
          ================================= */}

          {allotmentMode === "teacher" && (

            <div className="tm-layout">

              {/* TEACHER LIST */}

              <section className="tm-panel tm-teacher-panel">

                <div className="tm-panel-heading">
                  <UserRound size={19} />
                  <h2>1. Select Teacher</h2>
                </div>

                <div className="tm-search">
                  <Search size={17} />

                  <input
                    value={searchTeacher}
                    onChange={(event) =>
                      setSearchTeacher(event.target.value)
                    }
                    placeholder="Search teachers..."
                  />
                </div>

                <div className="tm-teacher-list">

                  {filteredTeachers.map((teacher) => (

                    <button
                      key={teacher.id}
                      className={`tm-teacher-option ${
                        selectedTeacher === teacher.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedTeacher(teacher.id);
                        setSelectedClass("");
                        setSelectedSection("");
                        setNotice("");
                      }}
                    >

                      <span className="tm-avatar">
                        {teacher.name.charAt(0).toUpperCase()}
                      </span>

                      <span className="tm-teacher-name">
                        {teacher.name}
                      </span>

                      {selectedTeacher === teacher.id && (
                        <Check size={18} />
                      )}

                    </button>

                  ))}

                  {filteredTeachers.length === 0 && (
                    <p className="tm-muted">
                      No teachers found.
                    </p>
                  )}

                </div>

              </section>

              {/* CLASS, SECTION AND SUBJECTS */}

              <section className="tm-panel tm-assignment-panel">

                <div className="tm-panel-heading">
                  <GraduationCap size={19} />
                  <h2>2. Select Class</h2>
                </div>

                {!selectedTeacher ? (

                  <p className="tm-instruction">
                    Select a teacher to continue.
                  </p>

                ) : (

                  <>

                    <div className="tm-selected-teacher">

                      <span className="tm-avatar">
                        {selectedTeacherData?.name
                          ?.charAt(0)
                          .toUpperCase()}
                      </span>

                      <div>
                        <strong>{selectedTeacherData?.name}</strong>
                        <span>Selected teacher</span>
                      </div>

                    </div>

                    <div className="tm-class-list">

                      {classes.map((item) => (

                        <button
                          key={item.id}
                          className={`tm-class-option ${
                            selectedClass === item.id
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedClass(item.id);
                            setSelectedSection("");
                            setNotice("");
                          }}
                        >

                          <GraduationCap size={17} />
                          <span>{item.name}</span>

                          {selectedClass === item.id && (
                            <Check size={17} />
                          )}

                        </button>

                      ))}

                    </div>

                    {selectedClass && (

                      <div className="tm-section-selector">

                        <div className="tm-subject-heading">
                          <GraduationCap size={18} />
                          <h2>3. Select Section</h2>
                        </div>

                        {sections.length === 0 ? (

                          <p className="tm-instruction">
                            No active sections found for this class.
                          </p>

                        ) : (

                          <div className="tm-class-list">

                            {sections.map((section) => (

                              <button
                                key={section.id}
                                className={`tm-class-option ${
                                  selectedSection === section.id
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedSection(section.id);
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

                  </>

                )}

                {selectedTeacher &&
                 selectedClass &&
                 selectedSection && (

                  <div className="tm-section-subjects">

                    <div className="tm-subject-heading">
                      <BookOpen size={18} />
                      <h2>4. Assign Subjects</h2>
                    </div>

                    <p className="tm-instruction">
                      {getClassName(selectedClass)} -{" "}
                      {selectedSectionData?.name}
                    </p>

                    {availableSubjects.length === 0 ? (

                      <p className="tm-instruction">
                        No subjects mapped to this class.
                      </p>

                    ) : (

                      <div className="tm-subject-list">

                        {availableSubjects.map((subject) => {

                          const assigned = teacherMappings.some(
                            (mapping) =>
                              mapping.teacherId === selectedTeacher &&
                              mapping.classId === selectedClass &&
                              mapping.sectionId === selectedSection &&
                              mapping.subjectId === subject.id
                          );

                          return (

                            <div
                              className="tm-subject-option"
                              key={subject.id}
                            >

                              <div>
                                <strong>{subject.name}</strong>

                                <span>
                                  {assigned
                                    ? "Already assigned"
                                    : "Available"}
                                </span>
                              </div>

                              <button
                                className={
                                  assigned ? "assigned" : "assign"
                                }
                                disabled={assigned}
                                onClick={() =>
                                  assignTeacherWise(subject.id)
                                }
                              >
                                {assigned ? (
                                  <>
                                    <Check size={15} />
                                    Assigned
                                  </>
                                ) : (
                                  "Assign"
                                )}
                              </button>

                            </div>

                          );

                        })}

                      </div>

                    )}

                  </div>

                )}

              </section>

            </div>

          )}

          {/* =================================
              OPTION 2: CLASS-WISE
          ================================= */}

          {allotmentMode === "class" && (

            <section className="tm-panel tm-classwise-panel">

              <div className="tm-panel-heading">
                <GraduationCap size={19} />
                <h2>Class-wise Teacher Allotment</h2>
              </div>

              <p className="tm-instruction">
                Select a class, section and subject. Then select
                one or multiple teachers.
              </p>

              {/* CLASS SELECTION */}

              <div className="tm-classwise-step">

                <h3>1. Select Class</h3>

                <div className="tm-class-list">

                  {classes.map((item) => (

                    <button
                      key={item.id}
                      className={`tm-class-option ${
                        selectedClass === item.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedClass(item.id);
                        setSelectedSection("");
                        setSelectedSubject("");
                        setSelectedTeachers([]);
                        setNotice("");
                      }}
                    >

                      <GraduationCap size={17} />
                      <span>{item.name}</span>

                      {selectedClass === item.id && (
                        <Check size={17} />
                      )}

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
                            selectedSection === section.id
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedSection(section.id);
                            setSelectedSubject("");
                            setSelectedTeachers([]);
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
                            selectedSubject === subject.id
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            selectSubjectForClasswise(subject.id)
                          }
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

              {selectedClass &&
               selectedSection &&
               selectedSubject && (

                <div className="tm-classwise-step">

                  <div className="tm-subject-heading">
                    <UserPlus size={19} />
                    <h3>4. Select Available Teachers</h3>
                  </div>

                  <p className="tm-instruction">
                    {getSubjectName(selectedSubject)} —{" "}
                    {getClassName(selectedClass)} -{" "}
                    {selectedSectionData?.name}
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
                              {getTeacherName(mapping.teacherId)}{periodsLabel(mapping)}
                            </span>

                            <span className="tm-assigned-label">Assigned</span>

                            <button
                              className="tm-remove"
                              onClick={() =>
                                removeAssignment(mapping.id)
                              }
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

                      const checked = selectedTeachers.includes(
                        teacher.id
                      );

                      return (

                        <label
                          className="tm-available-teacher"
                          key={teacher.id}
                        >

                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleTeacherSelection(teacher.id)
                            }
                          />

                          <span className="tm-avatar">
                            {teacher.name.charAt(0).toUpperCase()}
                          </span>

                          <span className="tm-teacher-name">
                            {teacher.name}
                          </span>

                          {assigned ? (
                            <span className="tm-assigned-label">
                              Assigned
                            </span>
                          ) : (
                            <span className="tm-available-label">
                              Available
                            </span>
                          )}

                        </label>

                      );

                    })}

                    {filteredAvailableTeachers.length === 0 && (
                      <p className="tm-muted">
                        No teachers found.
                      </p>
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

      {/* =================================
          12. ASSIGNMENT REVIEW
      ================================= */}

      <section className="tm-panel tm-review-panel">

        <div className="tm-panel-heading">
          <BookOpen size={19} />
          <h2>Review Teacher Assignments</h2>
        </div>

        <div className="tm-review-tabs">

          <button
            className={
              reviewMode === "teacher" ? "active" : ""
            }
            onClick={() => setReviewMode("teacher")}
          >
            Teacher-wise
          </button>

          <button
            className={
              reviewMode === "class" ? "active" : ""
            }
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
                Select a teacher in Teacher-wise Allotment to view
                their assignments.
              </p>

            ) : currentTeacherAssignments.length === 0 ? (

              <p className="tm-instruction">
                No subjects assigned to {selectedTeacherData?.name}.
              </p>

            ) : (

              <div className="tm-review-list">

                {currentTeacherAssignments.map((mapping) => (

                  <div
                    className="tm-review-item"
                    key={mapping.id}
                  >

                    <div>
                      <strong>
                        {getClassName(mapping.classId)}
                      </strong>

                      <span>
                        {getSectionName(
                          mapping.classId,
                          mapping.sectionId
                        )}
                        {" • "}
                        {getSubjectName(mapping.subjectId)} {mapping.subjectCode ? `(${mapping.subjectCode})` : ""}
                        {periodsLabel(mapping)}
                      </span>
                    </div>

                    <button
                      className="tm-remove"
                      onClick={() =>
                        removeAssignment(mapping.id)
                      }
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
                (mapping) => mapping.classId === item.id
              );

              const activeSections = (item.sections || []).filter(
                (section) => section.active !== false
              );

              const legacyAssignments = classAssignments.filter(
                (mapping) => !mapping.sectionId
              );

              return (

                <div
                  className="tm-class-review"
                  key={item.id}
                >

                  <h3>{item.name}</h3>

                  {activeSections.map((section) => {

                    const sectionAssignments = classAssignments.filter(
                      (mapping) => mapping.sectionId === section.id
                    );

                    return (

                      <div
                        className="tm-section-review"
                        key={section.id}
                      >

                        <h4>Section {section.name}</h4>

                        {sectionAssignments.length === 0 ? (

                          <p className="tm-instruction">
                            No teachers assigned yet.
                          </p>

                        ) : (

                          <div className="tm-review-list">

                            {sectionAssignments.map((mapping) => (

                              <div
                                className="tm-review-item"
                                key={mapping.id}
                              >

                                <div>
                                  <strong>
                                    {getSubjectName(mapping.subjectId)} {mapping.subjectCode ? `(${mapping.subjectCode})` : ""}
                                  </strong>

                                  <span>
                                    {getTeacherName(mapping.teacherId)}{periodsLabel(mapping)}
                                  </span>
                                </div>

                                <button
                                  className="tm-remove"
                                  onClick={() =>
                                    removeAssignment(mapping.id)
                                  }
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

                          <div
                            className="tm-review-item"
                            key={mapping.id}
                          >

                            <div>
                              <strong>
                                {getSubjectName(mapping.subjectId)} {mapping.subjectCode ? `(${mapping.subjectCode})` : ""}
                              </strong>

                              <span>
                                {getTeacherName(mapping.teacherId)}{periodsLabel(mapping)}
                              </span>
                            </div>

                            <button
                              className="tm-remove"
                              onClick={() =>
                                removeAssignment(mapping.id)
                              }
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

    </div>
  );
}
