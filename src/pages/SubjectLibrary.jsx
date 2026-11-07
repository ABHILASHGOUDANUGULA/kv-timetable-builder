
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Archive,
  RotateCcw,
  BookOpen,
  X,
  Check,
} from "lucide-react";
import {
  KVS_SUBJECT_PRESETS,
  COMMON_SUBJECT_CATALOGUE,
  getKVSStage,
  getKVSSubjectsForClass,
} from "../data/kvsSubjectPresets";
import "../styles/subject-library.css";

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function SubjectLibrary({
  project,
  onSave,
  onSaveMappings,
}) {
  const [subjects, setSubjects] = useState(
    project?.data?.subjects || []
  );
  const [mappings, setMappings] = useState(
  project?.data?.mappings || []
);
// Load subjects and mappings when switching school projects
useEffect(() => {
  setSubjects(project?.data?.subjects || []);
  setMappings(project?.data?.mappings || []);

  setSelectedSubjectId("");
  setSelectedClassIds([]);
  setPeriodValues({});

  setSubjectName("");
  setShortName("");
  setEditingId(null);
  setSearchText("");
  setShowArchived(false);
  setNotice("");
}, [project?.id]);

const [selectedSubjectId, setSelectedSubjectId] = useState("");
const [selectedClassIds, setSelectedClassIds] = useState([]);

const [periodValues, setPeriodValues] = useState({});

  const [subjectName, setSubjectName] = useState("");
  const [shortName, setShortName] = useState("");
  const [catalogueSelection, setCatalogueSelection] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState("");

  const onSaveRef = useRef(onSave);
  const onSaveMappingsRef = useRef(onSaveMappings);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
  onSaveMappingsRef.current = onSaveMappings;
}, [onSaveMappings]);

  // Automatically save subjects to the current school project.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current?.(subjects);
    }, 500);

    return () => clearTimeout(timer);
  }, [subjects, project?.id]);
// Automatically save class-subject mappings to the current school project.
useEffect(() => {
  const timer = setTimeout(() => {
    onSaveMappingsRef.current?.(mappings);
  }, 500);

  return () => clearTimeout(timer);
}, [mappings, project?.id]);
  function resetForm() {
    setSubjectName("");
    setShortName("");
    setEditingId(null);
  }

  function saveSubject(event) {
    event.preventDefault();

    const name = subjectName.trim();
    const short = shortName.trim();

    if (!name) {
      setNotice("Please enter the full subject name.");
      return;
    }

    const duplicate = subjects.some(
      (subject) =>
        subject.name.toLowerCase() === name.toLowerCase() &&
        subject.id !== editingId
    );

    if (duplicate) {
      setNotice("This subject name already exists.");
      return;
    }

    if (editingId) {
      setSubjects((previous) =>
        previous.map((subject) =>
          subject.id === editingId
            ? {
                ...subject,
                name,
                shortName: short,
                updatedAt: new Date().toISOString(),
              }
            : subject
        )
      );

      setNotice(`${name} updated successfully.`);
    } else {
      const newSubject = {
        id: createId(),
        name,
        shortName: short,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSubjects((previous) => [...previous, newSubject]);

      setNotice(`${name} added successfully.`);
    }

    resetForm();
  }

  function startEditing(subject) {
    setEditingId(subject.id);
    setSubjectName(subject.name);
    setShortName(subject.shortName || "");
    setNotice("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    resetForm();
    setNotice("");
  }

  function archiveSubject(subjectId) {
    const subject = subjects.find(
      (item) => item.id === subjectId
    );

    if (!subject) return;

    const confirmed = window.confirm(
      `Archive "${subject.name}"? You can restore it later.`
    );

    if (!confirmed) return;

    setSubjects((previous) =>
      previous.map((item) =>
        item.id === subjectId
          ? {
              ...item,
              active: false,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (editingId === subjectId) {
      resetForm();
    }

    setNotice(`${subject.name} archived successfully.`);
  }

  function restoreSubject(subjectId) {
    const subject = subjects.find(
      (item) => item.id === subjectId
    );

    if (!subject) return;

    setSubjects((previous) =>
      previous.map((item) =>
        item.id === subjectId
          ? {
              ...item,
              active: true,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    setNotice(`${subject.name} restored successfully.`);
  }

  const classes = (project?.data?.classes || []).filter(
  (item) => item.active !== false
);
const affiliation = project?.data?.school?.affiliation || "KVS";
const isKVS = affiliation === "KVS";

const getClassPreset = (className) => {
  if (!isKVS) return null;
  return getKVSSubjectsForClass(className);
};
const subjectCatalogue = isKVS
  ? Array.from(
      new Map(
        Object.values(KVS_SUBJECT_PRESETS)
          .flatMap((stage) => stage.subjects)
          .map((subject) => [subject.name, subject])
      ).values()
    )
  : COMMON_SUBJECT_CATALOGUE;

function handleCatalogueSelection(name) {
  setCatalogueSelection(name);

  const selected = subjectCatalogue.find(
    (subject) => subject.name === name
  );

  if (selected) {
    setSubjectName(selected.name);
    setShortName(selected.shortName || "");
    setNotice("");
  }
}
function updatePeriodValue(classId, value) {
  if (value === "") {
    setPeriodValues((previous) => ({ ...previous, [classId]: "" }));
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return;
  setPeriodValues((previous) => ({ ...previous, [classId]: Math.floor(n) }));
}

function toggleClassSelection(classId) {
  setSelectedClassIds((previous) =>
    previous.includes(classId)
      ? previous.filter((id) => id !== classId)
      : [...previous, classId]
  );
}

function applySubjectAssignment() {
  if (!selectedSubjectId) {
    setNotice("Please select a subject first.");
    return;
  }

  if (selectedClassIds.length === 0) {
    setNotice("Please select at least one class.");
    return;
  }
  const invalidClass = selectedClassIds.find((classId) => {
  const existing = mappings.find(
    (item) =>
      item.classId === classId &&
      item.subjectId === selectedSubjectId
  );

  const periods = Number(
    periodValues[classId] ??
    existing?.periodsPerWeek ??
    0
  );

  return !Number.isInteger(periods) || periods < 1;
});

if (invalidClass) {
  setNotice(
    "Enter at least 1 whole period per week for every selected class."
  );
  return;
}

  setMappings((previous) => {
    const updated = [...previous];

    selectedClassIds.forEach((classId) => {
      const existingIndex = updated.findIndex(
        (item) =>
          item.classId === classId &&
          item.subjectId === selectedSubjectId
      );

      const existing =
        existingIndex >= 0 ? updated[existingIndex] : null;

      const periods = Number(
        periodValues[classId] ??
        existing?.periodsPerWeek ??
        0
      );

      const mapping = {
        id: existing?.id || createId(),
        classId,
        subjectId: selectedSubjectId,
        periodsPerWeek: periods,
      };

      if (existingIndex >= 0) {
        updated[existingIndex] = mapping;
      } else {
        updated.push(mapping);
      }
    });

    return updated;
  });

  setNotice("Subject assignments saved successfully.");
}
  const activeSubjects = subjects.filter(
    (subject) => subject.active !== false
  );
  const selectedSubject = activeSubjects.find(
  (subject) => subject.id === selectedSubjectId
);

  const archivedSubjects = subjects.filter(
    (subject) => subject.active === false
  );

  const displayedSubjects = subjects
    .filter((subject) =>
      showArchived
        ? subject.active === false
        : subject.active !== false
    )
    .filter((subject) =>
      subject.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (subject.shortName || "")
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );

  return (
    <div className="subject-library-page">

      {/* HEADER */}
      <div className="subject-library-header">
        <div>
          <h1>Subject Library</h1>
          <p>
            Create and manage all subjects offered by your school.
          </p>
        </div>

        <div className="subject-library-project">
          <BookOpen size={17} />
          <span>{project?.schoolName || "Current School"}</span>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="subject-library-stats">
        <div className="subject-stat-card">
          <span>Active Subjects</span>
          <strong>{activeSubjects.length}</strong>
        </div>

        <div className="subject-stat-card">
          <span>Archived Subjects</span>
          <strong>{archivedSubjects.length}</strong>
        </div>

        <div className="subject-stat-card">
          <span>Total Subjects</span>
          <strong>{subjects.length}</strong>
        </div>
      </div>

      {/* ADD / EDIT SUBJECT */}
      <section className="subject-panel">
        <div className="subject-panel-heading">
          <div>
            <h2>
              {editingId ? "Edit Subject" : "Add New Subject"}
            </h2>
            <p>
              Enter the full name. A short display name is optional.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              className="subject-cancel-icon"
              onClick={cancelEditing}
              title="Cancel editing"
            >
              <X size={19} />
            </button>
          )}
        </div>

        <form onSubmit={saveSubject}>
          <div className="subject-form-field" style={{ marginBottom: "18px" }}>
  <label htmlFor="subject-catalogue">
    Choose from Subject Catalogue (Optional)
  </label>

  <select
    id="subject-catalogue"
    value={catalogueSelection}
    onChange={(event) =>
      handleCatalogueSelection(event.target.value)
    }
  >
    <option value="">Select a preset subject</option>

    {subjectCatalogue.map((subject) => (
      <option key={subject.name} value={subject.name}>
        {subject.name} ({subject.shortName})
      </option>
    ))}
  </select>

  <small>
    Select a subject to automatically fill its name and short name.
    You can edit them before adding.
  </small>
</div>
          <div className="subject-form-grid">

            <div className="subject-form-field">
              <label htmlFor="subject-full-name">
                Full Subject Name *
              </label>

              <input
                id="subject-full-name"
                type="text"
                value={subjectName}
                onChange={(event) =>
                  setSubjectName(event.target.value)
                }
                placeholder="Example: Mathematics"
                required
              />
            </div>

            <div className="subject-form-field">
              <label htmlFor="subject-short-name">
                Short Display Name (Optional)
              </label>

              <input
                id="subject-short-name"
                type="text"
                value={shortName}
                onChange={(event) =>
                  setShortName(event.target.value)
                }
                placeholder="Example: Maths"
              />

              <small>
                Used when the administrator chooses a compact timetable.
              </small>
            </div>

          </div>

          <div className="subject-form-actions">
            <button
              type="submit"
              className="subject-primary-btn"
            >
              {editingId ? (
                <>
                  <Check size={17} />
                  Update Subject
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Add Subject
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                className="subject-secondary-btn"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

{/* SUBJECT–CLASS–PERIOD ASSIGNMENT */}
<section className="subject-panel">
  <div className="subject-panel-heading">
    <div>
      <h2>Subject–Class–Periods Assignment</h2>
      <p>
        Select a subject, choose the classes where it is taught,
        and enter the weekly periods for each class.
      </p>
    </div>
  </div>

  <div className="subject-form-field">
    <label htmlFor="mapping-subject">
      Select Subject *
    </label>

    <select
      id="mapping-subject"
      value={selectedSubjectId}
      onChange={(event) => {
        setSelectedSubjectId(event.target.value);
        setSelectedClassIds([]);
        setPeriodValues({});
      }}
    >
      <option value="">Choose a subject</option>

      {activeSubjects.map((subject) => (
        <option key={subject.id} value={subject.id}>
          {subject.name}
        </option>
      ))}
    </select>
  </div>

  {selectedSubjectId && (
    <>
      <div className="subject-assignment-heading">
        <h3>Select Classes and Weekly Periods</h3>
        <p>
          Select each class and enter the required number of
          periods per week.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="subject-assignment-empty">
          No active classes found. Add classes in Classes & Sections first.
        </p>
      ) : (
        <div className="subject-assignment-grid">
          {classes.map((schoolClass) => {
            const existingMapping = mappings.find(
              (item) =>
                item.classId === schoolClass.id &&
                item.subjectId === selectedSubjectId
            );
            const presetSubject = getClassPreset(schoolClass.name)
  ?.subjects.find(
    (item) => item.name === selectedSubject?.name
  );

            const isSelected = selectedClassIds.includes(
              schoolClass.id
            );

            return (
              <div
                className={`subject-assignment-card ${
                  isSelected ? "selected" : ""
                }`}
                key={schoolClass.id}
              >
                <label className="subject-class-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      toggleClassSelection(schoolClass.id)
                    }
                  />

                  <strong>Class {schoolClass.name}</strong>
                </label>

                <div className="subject-period-field">
                  <label>
                    Periods per week
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
  periodValues[schoolClass.id] ??
  existingMapping?.periodsPerWeek ??
  presetSubject?.periods ??
  0
}
                    onChange={(event) =>
                      updatePeriodValue(
                        schoolClass.id,
                        event.target.value
                      )
                    }
                  />
                </div>

                {existingMapping && (
                  <small className="subject-existing-mapping">
                    Already assigned
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="subject-form-actions">
        <button
          type="button"
          className="subject-primary-btn"
          onClick={applySubjectAssignment}
          disabled={classes.length === 0}
        >
          <Check size={17} />
          Apply Assignment
        </button>
      </div>
    </>
  )}
</section>

{/* CLASS-WISE SUBJECT REVIEW */}
<section className="subject-panel">
  <div className="subject-panel-heading">
    <div>
      <h2>Class-wise Subject & Period Review</h2>
      <p>
        Review the subjects assigned to each class and their
        weekly period requirements.
      </p>
    </div>
  </div>

  {classes.length === 0 ? (
    <p className="subject-assignment-empty">
      No active classes available.
    </p>
  ) : (
    <div className="subject-class-review-list">
      {classes.map((schoolClass) => {
        const classMappings = mappings.filter(
          (item) => item.classId === schoolClass.id
        );

        return (
          <div
            className="subject-class-review-card"
            key={schoolClass.id}
          >
            <div className="subject-class-review-heading">
              <h3>Class {schoolClass.name}</h3>
              <span>
                {classMappings.length} subject(s)
              </span>
            </div>

            {classMappings.length === 0 ? (
              <p className="subject-assignment-empty">
                No subjects assigned to this class yet.
              </p>
            ) : (
              <div className="subject-review-table-wrapper">
                <table className="subject-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Periods per Week</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {classMappings.map((mapping) => {
                      const subject = subjects.find(
                        (item) => item.id === mapping.subjectId
                      );

                      if (!subject) return null;

                      return (
                        <tr key={mapping.id}>
                          <td className="subject-full-name">
                            {subject.name}
                            {subject.active === false && (
                              <span className="subject-not-set">
                                {" "}(Archived)
                              </span>
                            )}
                          </td>

                          <td>
                            {mapping.periodsPerWeek ?? 0}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="subject-archive-btn"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  `Remove ${subject.name} from Class ${schoolClass.name}?`
                                );

                                if (confirmed) {
                                  setMappings((previous) =>
                                    previous.filter(
                                      (item) => item.id !== mapping.id
                                    )
                                  );

                                  setNotice(
                                    `${subject.name} removed from Class ${schoolClass.name}.`
                                  );
                                }
                              }}
                            >
                              <X size={15} />
                              Remove
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
      })}
    </div>
  )}
</section>
      {/* SUBJECT LIST */}
      <section className="subject-panel">

        <div className="subject-list-heading">
          <div>
            <h2>
              {showArchived ? "Archived Subjects" : "Subject List"}
            </h2>

            <p>
              {showArchived
                ? "Restore subjects when they are needed again."
                : "Manage the subjects available for class mapping."}
            </p>
          </div>

          <button
            type="button"
            className={`subject-view-toggle ${
              showArchived ? "archived-active" : ""
            }`}
            onClick={() => {
              setShowArchived((previous) => !previous);
              setSearchText("");
              setNotice("");
              resetForm();
            }}
          >
            {showArchived
              ? "View Active Subjects"
              : "View Archived"}
          </button>
        </div>

        <div className="subject-search">
          <Search size={18} />

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Search subjects by full or short name..."
          />
        </div>

        {displayedSubjects.length === 0 ? (
          <div className="subject-empty-state">
            <BookOpen size={30} />

            <h3>
              {showArchived
                ? "No archived subjects"
                : subjects.length === 0
                  ? "No subjects added yet"
                  : "No matching subjects found"}
            </h3>

            <p>
              {showArchived
                ? "Archived subjects will appear here."
                : "Start by adding your first subject above."}
            </p>
          </div>
        ) : (
          <div className="subject-table-wrapper">
            <table className="subject-table">
              <thead>
                <tr>
                  <th>Sl. No.</th>
                  <th>Full Subject Name</th>
                  <th>Short Display Name</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {displayedSubjects.map((subject, index) => (
                  <tr key={subject.id}>
                    <td>{index + 1}</td>

                    <td className="subject-full-name">
                      {subject.name}
                    </td>

                    <td>
                      {subject.shortName || (
                        <span className="subject-not-set">
                          Not provided
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="subject-row-actions">

                        {showArchived ? (
                          <button
                            type="button"
                            className="subject-restore-btn"
                            onClick={() =>
                              restoreSubject(subject.id)
                            }
                          >
                            <RotateCcw size={15} />
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="subject-edit-btn"
                              onClick={() =>
                                startEditing(subject)
                              }
                              title="Edit subject"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="subject-archive-btn"
                              onClick={() =>
                                archiveSubject(subject.id)
                              }
                              title="Archive subject"
                            >
                              <Archive size={15} />
                              Archive
                            </button>
                          </>
                        )}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="subject-list-footer">
          Showing {displayedSubjects.length} subject(s)
        </div>
      </section>

      {/* NOTICE */}
      {notice && (
        <div className="subject-notice" role="status">
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="subject-auto-save">
        <Check size={16} />
        Changes are saved automatically to this school project.
      </div>

    </div>
  );
}

export default SubjectLibrary;
