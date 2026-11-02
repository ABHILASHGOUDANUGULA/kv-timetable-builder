
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Search,
  X,
  Layers,
  RotateCcw,
} from "lucide-react";

import "../styles/class-subject-mapping.css";

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function ClassSubjectMapping({
  project,
  onSave,
  onSaveSubjects,
}) {
  const classes = (project?.data?.classes || []).filter(
    (item) => item.active !== false
  );

  const subjects = (project?.data?.subjects || []).filter(
    (item) => item.active !== false
  );

  const savedMappings = project?.data?.mappings || [];

  const [mappings, setMappings] = useState(savedMappings);
  // Reload class-subject mappings when switching school projects
useEffect(() => {
  setMappings(project?.data?.mappings || []);
  setSelectedSubjectId("");
  setSelectedClassIds([]);
  setPeriodValues({});
  setSearchText("");
  setActiveView("subject");
  setNotice("");
}, [project?.id]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [periodValues, setPeriodValues] = useState({});
  const [searchText, setSearchText] = useState("");
  const [activeView, setActiveView] = useState("subject");
  const [notice, setNotice] = useState("");

  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Automatically save mappings to the selected project.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current?.(mappings);
    }, 500);

    return () => clearTimeout(timer);
  }, [mappings, project?.id]);

  const selectedSubject = subjects.find(
    (subject) => subject.id === selectedSubjectId
  );

  const filteredClasses = classes.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const totalMappings = mappings.filter(
    (mapping) =>
      classes.some((item) => item.id === mapping.classId) &&
      subjects.some((item) => item.id === mapping.subjectId)
  ).length;

  function getClassSubjects(classId) {
    return mappings
      .filter((mapping) => mapping.classId === classId)
      .map((mapping) =>
        subjects.find((subject) => subject.id === mapping.subjectId)
      )
      .filter(Boolean);
  }

  function getSelectedCount() {
    if (!selectedSubjectId) return 0;

    return mappings.filter(
      (mapping) => mapping.subjectId === selectedSubjectId
    ).length;
  }

  function toggleClass(classId) {
    setSelectedClassIds((previous) =>
      previous.includes(classId)
        ? previous.filter((id) => id !== classId)
        : [...previous, classId]
    );
  }

  function updatePeriodValue(classId, value) {
  const periods = Math.max(0, Number(value) || 0);

  setPeriodValues((previous) => ({
    ...previous,
    [classId]: periods,
  }));
}
  function selectAllClasses() {
    setSelectedClassIds(filteredClasses.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedClassIds([]);
  }

  function assignSubject() {
    if (!selectedSubjectId) {
      setNotice("Please select a subject first.");
      return;
    }

    if (selectedClassIds.length === 0) {
      setNotice("Please select at least one class.");
      return;
    }

    const updatedMappings = selectedClassIds.map((classId) => {
  const existingMapping = mappings.find(
    (mapping) =>
      mapping.classId === classId &&
      mapping.subjectId === selectedSubjectId
  );

  const periods =
    periodValues[classId] ??
    existingMapping?.periodsPerWeek ??
    0;

  if (existingMapping) {
    return {
      ...existingMapping,
      periodsPerWeek: periods,
    };
  }

  return {
    id: createId(),
    classId,
    subjectId: selectedSubjectId,
    periodsPerWeek: periods,
  };
});

setMappings((previous) => [
  ...previous.filter(
    (mapping) => !selectedClassIds.includes(mapping.classId) ||
      mapping.subjectId !== selectedSubjectId
  ),
  ...updatedMappings,
]);

setNotice(
  `${selectedSubject.name} allocation saved for ${selectedClassIds.length} class(es).`
);

setSelectedClassIds([]);
  }

  function removeSubjectFromSelectedClasses() {
    if (!selectedSubjectId || selectedClassIds.length === 0) {
      setNotice("Select a subject and at least one class.");
      return;
    }

    const updated = mappings.filter(
      (mapping) =>
        !(
          mapping.subjectId === selectedSubjectId &&
          selectedClassIds.includes(mapping.classId)
        )
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
    setMappings((previous) =>
      previous.filter(
        (mapping) =>
          !(
            mapping.classId === classId &&
            mapping.subjectId === subjectId
          )
      )
    );

    const className = classes.find(
      (item) => item.id === classId
    )?.name;

    setNotice(`Subject removed from Class ${className}.`);
  }

  return (
    <div className="mapping-page">
      <div className="mapping-header">
        <div>
          <h1>Class–Subject Mapping</h1>
          <p>
            Assign subjects to classes in bulk or review assignments class-wise.
          </p>
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
                <p>
                  Choose one subject to assign it to multiple classes.
                </p>
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
                      selectedSubjectId === subject.id
                        ? "mapping-subject-selected"
                        : ""
                    }`}
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

                    {subject.shortName && (
                      <small>{subject.shortName}</small>
                    )}
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
                />
              </div>

              <button type="button" onClick={selectAllClasses}>
                Select All
              </button>

              <button type="button" onClick={clearSelection}>
                Clear
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="mapping-empty">
                No active classes found. Configure classes first.
              </div>
            ) : (
              <div className="mapping-class-grid">
                {filteredClasses.map((item) => {
  const existingMapping = mappings.find(
    (mapping) =>
      mapping.classId === item.id &&
      mapping.subjectId === selectedSubjectId
  );

  const alreadyAssigned = Boolean(existingMapping);

  return (
    <div
      key={item.id}
      className={`mapping-class-option ${
        selectedClassIds.includes(item.id)
          ? "mapping-class-selected"
          : ""
      }`}
    >
      <input
        type="checkbox"
        checked={selectedClassIds.includes(item.id)}
        onChange={() => toggleClass(item.id)}
      />

      <span>
        <strong>{item.name}</strong>
        <small>
          {item.sections?.length || 0} section(s)
        </small>
      </span>

      {alreadyAssigned && (
        <span className="mapping-assigned-tag">
          Assigned
        </span>
      )}

      <div className="mapping-period-input">
        <label htmlFor={`periods-${item.id}`}>
          Periods/week
        </label>

        <input
          id={`periods-${item.id}`}
          type="number"
          min="0"
          step="1"
          value={
            periodValues[item.id] ??
            existingMapping?.periodsPerWeek ??
            0
          }
          onChange={(event) =>
            updatePeriodValue(item.id, event.target.value)
          }
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
                <strong>{selectedSubject.name}</strong> is currently assigned
                to {getSelectedCount()} class(es).
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
              <p>
                Review and remove subjects assigned to each class.
              </p>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="mapping-empty">
              No active classes found.
            </div>
          ) : (
            <div className="mapping-review-list">
              {classes.map((item) => {
                const classSubjects = getClassSubjects(item.id);

                return (
                  <div className="mapping-review-card" key={item.id}>
                    <div className="mapping-review-heading">
                      <div>
                        <h3>Class {item.name}</h3>
                        <span>
                          {item.sections?.length || 0} section(s)
                        </span>
                      </div>

                      <span className="mapping-review-count">
                        {classSubjects.length} subject(s)
                      </span>
                    </div>

                    {classSubjects.length === 0 ? (
                      <p className="mapping-no-subjects">
                        No subjects assigned yet.
                      </p>
                    ) : (
                      <div className="mapping-review-subjects">
                        {classSubjects.map((subject) => (
                          <div
                            className="mapping-review-subject"
                            key={subject.id}
                          >
                            <span>{subject.name}</span>

                            <button
                              type="button"
                              title="Remove subject"
                              onClick={() =>
                                removeSingleMapping(item.id, subject.id)
                              }
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
        <div className="mapping-notice" role="status">
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
