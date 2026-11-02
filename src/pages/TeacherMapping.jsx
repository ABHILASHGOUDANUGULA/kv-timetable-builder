
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
    project?.data?.teacherMappings || []
  );

  const [allotmentMode, setAllotmentMode] = useState("teacher");

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Class-wise selection
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState([]);

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
    setTeacherMappings(project?.data?.teacherMappings || []);

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

  function addAssignment(teacherId, classId, sectionId, subjectId) {
    const alreadyAssigned = teacherMappings.some(
      (mapping) =>
        mapping.teacherId === teacherId &&
        mapping.classId === classId &&
        mapping.sectionId === sectionId &&
        mapping.subjectId === subjectId
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
    };

    setTeacherMappings((previous) => [
      ...previous,
      newAssignment,
    ]);

    return true;
  }

  // ==========================================
  // 7. TEACHER-WISE ALLOTMENT
  // ==========================================

  function assignTeacherWise(subjectId) {
    if (!selectedTeacher || !selectedClass || !selectedSection) {
      setNotice("Select teacher, class and section first.");
      return;
    }

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
      `${getSubjectName(subjectId)} assigned to ${selectedTeacherData?.name}.`
    );
  }

  // ==========================================
  // 8. CLASS-WISE TEACHER SELECTION
  // ==========================================

  function isTeacherAssigned(teacherId) {
    return teacherMappings.some(
      (mapping) =>
        mapping.teacherId === teacherId &&
        mapping.classId === selectedClass &&
        mapping.sectionId === selectedSection &&
        mapping.subjectId === selectedSubject
    );
  }

  function toggleTeacherSelection(teacherId) {
    if (isTeacherAssigned(teacherId)) {
      return;
    }

    setSelectedTeachers((previous) =>
      previous.includes(teacherId)
        ? previous.filter((id) => id !== teacherId)
        : [...previous, teacherId]
    );
  }

  function assignSelectedTeachers() {
    if (!selectedClass || !selectedSection || !selectedSubject) {
      setNotice("Select class, section and subject first.");
      return;
    }

    if (selectedTeachers.length === 0) {
      setNotice("Select at least one available teacher.");
      return;
    }

    let addedCount = 0;

    selectedTeachers.forEach((teacherId) => {
      const added = addAssignment(
        teacherId,
        selectedClass,
        selectedSection,
        selectedSubject
      );

      if (added) {
        addedCount++;
      }
    });

    setSelectedTeachers([]);

    setNotice(
      addedCount > 0
        ? `${addedCount} teacher(s) assigned successfully.`
        : "No new assignments were added."
    );
  }

  // ==========================================
  // 9. REMOVE ASSIGNMENT
  // ==========================================

  function removeAssignment(id) {
    setTeacherMappings((previous) =>
      previous.filter((mapping) => mapping.id !== id)
    );

    setSelectedTeachers([]);

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
                          onClick={() => {
                            setSelectedSubject(subject.id);
                            setSelectedTeachers([]);
                            setNotice("");
                          }}
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

                      <strong>Already assigned teachers</strong>

                      <div className="tm-assigned-teacher-list">

                        {currentSubjectAssignments.map((mapping) => (

                          <div
                            className="tm-assigned-teacher"
                            key={mapping.id}
                          >

                            <span>
                              {getTeacherName(mapping.teacherId)}
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
                          className={`tm-available-teacher ${
                            assigned ? "already-assigned" : ""
                          }`}
                          key={teacher.id}
                        >

                          <input
                            type="checkbox"
                            checked={assigned || checked}
                            disabled={assigned}
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
                              Already assigned
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
                      Assign Selected Teachers
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
                        {getSubjectName(mapping.subjectId)}
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
                                    {getSubjectName(mapping.subjectId)}
                                  </strong>

                                  <span>
                                    {getTeacherName(mapping.teacherId)}
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
                                {getSubjectName(mapping.subjectId)}
                              </strong>

                              <span>
                                {getTeacherName(mapping.teacherId)}
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
