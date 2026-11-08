import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Search, X, Layers } from "lucide-react";

import "../styles/class-subject-mapping.css";

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function normalizeMappings(value, classes, subjects) {
  if (!Array.isArray(value)) return [];

  const classIds = new Set(classes.map((item) => item.id));
  const subjectIds = new Set(subjects.map((item) => item.id));
  const seen = new Set();

  return value.reduce((result, mapping) => {
    if (
      !mapping ||
      !classIds.has(mapping.classId) ||
      !subjectIds.has(mapping.subjectId)
    ) {
      return result;
    }

    const key = `${mapping.classId}::${mapping.subjectId}`;
    if (seen.has(key)) return result;
    seen.add(key);

    const rawPeriods = Number(mapping.periodsPerWeek);
    const periodsPerWeek =
      Number.isFinite(rawPeriods) && rawPeriods >= 0
        ? Math.floor(rawPeriods)
        : 0;

    result.push({
      ...mapping,
      id: mapping.id || createId(),
      periodsPerWeek,
    });
    return result;
  }, []);
}

function ClassSubjectMapping({ project, onSave, onSaveSubjects }) {
  const classes = (project?.data?.classes || []).filter(
    (item) => item?.active !== false && item?.id
  );
  const subjects = (project?.data?.subjects || []).filter(
    (item) => item?.active !== false && item?.id
  );

  const projectId = project?.id;
  const normalizedSavedMappings = useMemo(
    () => normalizeMappings(project?.data?.mappings, classes, subjects),
    [project?.data?.mappings, classes, subjects]
  );

  const [mappings, setMappings] = useState(normalizedSavedMappings);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [periodValues, setPeriodValues] = useState({});
  const [searchText, setSearchText] = useState("");
  const [activeView, setActiveView] = useState("subject");
  const [notice, setNotice] = useState("");

  const onSaveRef = useRef(onSave);
  const activeProjectIdRef = useRef(projectId);
  const saveInitializedRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Prevent a pending debounce from saving the previous project's mappings
  // into the newly selected project.
  useEffect(() => {
    activeProjectIdRef.current = projectId;
    setMappings(normalizedSavedMappings);
    setSelectedSubjectId("");
    setSelectedClassIds([]);
    setPeriodValues({});
    setSearchText("");
    setActiveView("subject");
    setNotice("");
    saveInitializedRef.current = false;
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId) return;

    if (!saveInitializedRef.current) {
      saveInitializedRef.current = true;
      return;
    }

    const projectIdAtSchedule = projectId;
    const timer = setTimeout(() => {
      if (activeProjectIdRef.current !== projectIdAtSchedule) return;
      onSaveRef.current?.(mappings);
    }, 500);

    return () => clearTimeout(timer);
  }, [mappings, projectId]);

  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId
  );

  const filteredClasses = classes.filter((item) =>
    String(item.name || "").toLowerCase().includes(searchText.trim().toLowerCase())
  );

  const validMappings = mappings.filter(
    (mapping) =>
      classes.some((item) => item.id === mapping.classId) &&
      subjects.some((item) => item.id === mapping.subjectId)
  );

  const totalMappings = validMappings.length;

  function getClassSubjects(classId) {
    return validMappings
      .filter((mapping) => mapping.classId === classId)
      .map((mapping) => ({
        mapping,
        subject: subjects.find((subject) => subject.id === mapping.subjectId),
      }))
      .filter((item) => item.subject);
  }

  function getSelectedCount() {
    if (!selectedSubjectId) return 0;
    return validMappings.filter(
      (mapping) => mapping.subjectId === selectedSubjectId
    ).length;
  }

  function toggleClass(classId) {
    setSelectedClassIds((previous) =>
      previous.includes(classId)
        ? previous.filter((id) => id !== classId)
        : [...previous, classId]
    );
    setNotice("");
  }

  function updatePeriodValue(classId, value) {
    if (value === "") {
      setPeriodValues((previous) => ({ ...previous, [classId]: "" }));
      return;
    }

    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || !Number.isInteger(number)) {
      return;
    }

    // A defensive ceiling avoids accidental huge values; the school can
    // change this limit if its timetable has an unusual weekly structure.
    if (number > 60) {
      setNotice("Periods/week cannot exceed 60.");
      return;
    }

    setPeriodValues((previous) => ({ ...previous, [classId]: number }));
    setNotice("");
  }

  function selectAllClasses() {
    setSelectedClassIds((previous) => {
      const merged = new Set(previous);
      filteredClasses.forEach((item) => merged.add(item.id));
      return [...merged];
    });
    setNotice("");
  }

  function clearSelection() {
    setSelectedClassIds([]);
    setNotice("");
  }

  function assignSubject() {
    if (!selectedSubject) {
      setNotice("Please select a subject first.");
      return;
    }

    const targetClassIds = selectedClassIds.filter((id) =>
      classes.some((item) => item.id === id)
    );

    if (targetClassIds.length === 0) {
      setNotice("Please select at least one active class.");
      return;
    }

    const assignments = targetClassIds.map((classId) => {
      const existing = mappings.find(
        (mapping) =>
          mapping.classId === classId &&
          mapping.subjectId === selectedSubjectId
      );

      const enteredPeriods = periodValues[classId];
      const periods =
        enteredPeriods === "" || enteredPeriods === undefined
          ? existing?.periodsPerWeek ?? 0
          : enteredPeriods;

      if (!Number.isInteger(periods) || periods < 0 || periods > 60) {
        return null;
      }

      return {
        ...(existing || {}),
        id: existing?.id || createId(),
        classId,
        subjectId: selectedSubjectId,
        periodsPerWeek: periods,
      };
    });

    if (assignments.some((item) => item === null)) {
      setNotice("Enter a valid whole number from 0 to 60 for periods/week.");
      return;
    }

    setMappings((previous) => {
      const selectedIds = new Set(targetClassIds);
      return [
        ...previous.filter(
          (mapping) =>
            !(selectedIds.has(mapping.classId) &&
              mapping.subjectId === selectedSubjectId)
        ),
        ...assignments,
      ];
    });

    setNotice(
      `${selectedSubject.name} allocation saved for ${targetClassIds.length} class(es).`
    );
    setSelectedClassIds([]);
  }

  function removeSubjectFromSelectedClasses() {
    if (!selectedSubject || selectedClassIds.length === 0) {
      setNotice("Select a subject and at least one class.");
      return;
    }

    const selectedIds = new Set(selectedClassIds);
    const updated = mappings.filter(
      (mapping) =>
        !(mapping.subjectId === selectedSubjectId &&
          selectedIds.has(mapping.classId))
    );
    const removedCount = mappings.length - updated.length;

    if (removedCount === 0) {
      setNotice("No matching subject assignments were found.");
      return;
    }

    setMappings(updated);
    setSelectedClassIds([]);
    setNotice(
      `${selectedSubject.name} removed from ${removedCount} class(es).`
    );
  }

  function removeSingleMapping(classId, subjectId) {
    const className = classes.find((item) => item.id === classId)?.name || "";
    const subjectName = subjects.find((item) => item.id === subjectId)?.name || "Subject";

    setMappings((previous) =>
      previous.filter(
        (mapping) =>
          !(mapping.classId === classId && mapping.subjectId === subjectId)
      )
    );
    setNotice(`${subjectName} removed from Class ${className}.`);
  }

  return (
    <div className="mapping-page">
      <div className="mapping-header">
        <div>
          <h1>Class–Subject Mapping</h1>
          <p>Assign subjects to classes in bulk or review assignments class-wise.</p>
        </div>
        <div className="mapping-project-badge">
          <BookOpen size={15} />
          {project?.schoolName || "School Project"}
        </div>
      </div>

      <div className="mapping-summary">
        <div className="mapping-summary-card">
          <span>Active Classes</span>
          <strong>{classes.length}</strong>
        </div>
        <div className="mapping-summary-card">
          <span>Available Subjects</span>
          <strong>{subjects.length}</strong>
        </div>
        <div className="mapping-summary-card">
          <span>Total Assignments</span>
          <strong>{totalMappings}</strong>
        </div>
      </div>

      <div className="mapping-tabs">
        <button
          type="button"
          className={activeView === "subject" ? "mapping-tab-active" : ""}
          onClick={() => setActiveView("subject")}
        >
          <Layers size={16} />
          Subject-wise Assignment
        </button>
        <button
          type="button"
          className={activeView === "class" ? "mapping-tab-active" : ""}
          onClick={() => setActiveView("class")}
        >
          <BookOpen size={16} />
          Class-wise Review
        </button>
      </div>

      {activeView === "subject" && (
        <>
          <section className="mapping-panel">
            <div className="mapping-panel-heading">
              <div>
                <h2>1. Select Subject</h2>
                <p>Choose one subject to assign it to multiple classes.</p>
              </div>
            </div>

            {subjects.length === 0 ? (
              <div className="mapping-empty">
                No active subjects found. Add subjects in the Subject Library.
              </div>
            ) : (
              <div className="mapping-subject-grid">
                {subjects.map((subject) => (
                  <button
                    type="button"
                    key={subject.id}
                    className={`mapping-subject-option ${
                      selectedSubjectId === subject.id ? "mapping-subject-selected" : ""
                    }`}
                    aria-pressed={selectedSubjectId === subject.id}
                    onClick={() => {
                      setSelectedSubjectId(subject.id);
                      setSelectedClassIds([]);
                      setNotice("");
                    }}
                  >
                    <span>
                      {selectedSubjectId === subject.id ? (
                        <Check size={17} />
                      ) : (
                        <BookOpen size={17} />
                      )}
                    </span>
                    <strong>{subject.name}</strong>
                    {subject.shortName && <small>{subject.shortName}</small>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mapping-panel">
            <div className="mapping-panel-heading">
              <div>
                <h2>2. Select Classes</h2>
                <p>
                  {selectedSubject
                    ? `Choose the classes where ${selectedSubject.name} will be taught.`
                    : "Select a subject above first."}
                </p>
              </div>
            </div>

            <div className="mapping-selection-toolbar">
              <div className="mapping-search">
                <Search size={16} />
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search classes..."
                  aria-label="Search classes"
                />
              </div>
              <button type="button" onClick={selectAllClasses} disabled={!filteredClasses.length}>
                Select All
              </button>
              <button type="button" onClick={clearSelection} disabled={!selectedClassIds.length}>
                Clear
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="mapping-empty">No active classes found. Configure classes first.</div>
            ) : filteredClasses.length === 0 ? (
              <div className="mapping-empty">No classes match your search.</div>
            ) : (
              <div className="mapping-class-grid">
                {filteredClasses.map((item) => {
                  const existingMapping = mappings.find(
                    (mapping) =>
                      mapping.classId === item.id &&
                      mapping.subjectId === selectedSubjectId
                  );
                  const selected = selectedClassIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`mapping-class-option ${
                        selected ? "mapping-class-selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleClass(item.id)}
                        aria-label={`Select class ${item.name}`}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.sections?.length || 0} section(s)</small>
                      </span>
                      {existingMapping && (
                        <span className="mapping-assigned-tag">Assigned</span>
                      )}
                      <div className="mapping-period-input">
                        <label htmlFor={`periods-${item.id}`}>Periods/week</label>
                        <input
                          id={`periods-${item.id}`}
                          type="number"
                          min="0"
                          max="60"
                          step="1"
                          inputMode="numeric"
                          value={
                            periodValues[item.id] ??
                            existingMapping?.periodsPerWeek ??
                            0
                          }
                          onChange={(event) =>
                            updatePeriodValue(item.id, event.target.value)
                          }
                          aria-label={`Periods per week for class ${item.name}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mapping-selection-count">
              {selectedClassIds.length} class(es) selected
            </div>

            <div className="mapping-actions">
              <button
                type="button"
                className="mapping-assign-btn"
                onClick={assignSubject}
                disabled={!selectedSubjectId || selectedClassIds.length === 0}
              >
                <Check size={16} />
                Assign Subject
              </button>
              <button
                type="button"
                className="mapping-remove-btn"
                onClick={removeSubjectFromSelectedClasses}
                disabled={!selectedSubjectId || selectedClassIds.length === 0}
              >
                <X size={16} />
                Remove from Selected
              </button>
            </div>
          </section>

          {selectedSubject && (
            <section className="mapping-panel">
              <h2>3. Current Assignment Summary</h2>
              <p>
                <strong>{selectedSubject.name}</strong> is currently assigned to{" "}
                {getSelectedCount()} class(es).
              </p>
            </section>
          )}
        </>
      )}

      {activeView === "class" && (
        <section className="mapping-panel">
          <div className="mapping-panel-heading">
            <div>
              <h2>Class-wise Subject Review</h2>
              <p>Review and remove subjects assigned to each class.</p>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="mapping-empty">No active classes found.</div>
          ) : (
            <div className="mapping-review-list">
              {classes.map((item) => {
                const classSubjects = getClassSubjects(item.id);
                return (
                  <div className="mapping-review-card" key={item.id}>
                    <div className="mapping-review-heading">
                      <div>
                        <h3>Class {item.name}</h3>
                        <span>{item.sections?.length || 0} section(s)</span>
                      </div>
                      <span className="mapping-review-count">
                        {classSubjects.length} subject(s)
                      </span>
                    </div>

                    {classSubjects.length === 0 ? (
                      <p className="mapping-no-subjects">No subjects assigned yet.</p>
                    ) : (
                      <div className="mapping-review-subjects">
                        {classSubjects.map(({ mapping, subject }) => (
                          <div className="mapping-review-subject" key={mapping.id}>
                            <span>
                              {subject.name}
                              <small>
                                {mapping.periodsPerWeek} period(s)/week
                              </small>
                            </span>
                            <button
                              type="button"
                              title={`Remove ${subject.name} from Class ${item.name}`}
                              aria-label={`Remove ${subject.name} from Class ${item.name}`}
                              onClick={() => removeSingleMapping(item.id, subject.id)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {notice && (
        <div className="mapping-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <div className="mapping-save-note">
        <Check size={15} />
        Changes are saved automatically to this school project.
      </div>
    </div>
  );
}

export default ClassSubjectMapping;
