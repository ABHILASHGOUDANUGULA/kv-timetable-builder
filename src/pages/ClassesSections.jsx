import { useEffect, useRef, useState } from "react";
import "../styles/classes-sections.css";

const CLASS_OPTIONS = [
  "Nursery", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeClassName = (name) => String(name ?? "").trim().replace(/\s+/g, " ");
const normalizeSectionName = (name) => String(name ?? "").trim().replace(/\s+/g, " ");

const normalizeClasses = (value) =>
  Array.isArray(value)
    ? value.map((item, index) => ({
        ...item,
        id: item?.id ?? createId(),
        name: normalizeClassName(item?.name) || `Class ${index + 1}`,
        order: Number.isInteger(item?.order) ? item.order : index + 1,
        sections: Array.isArray(item?.sections)
          ? item.sections.map((section, sectionIndex) => ({
              ...section,
              id: section?.id ?? createId(),
              name: normalizeSectionName(section?.name) || `Section ${sectionIndex + 1}`,
              active: section?.active ?? true,
            }))
          : [],
        active: item?.active ?? true,
      }))
    : [];

const makeSections = (names, existingSections = []) => {
  const usedIds = new Set();
  return names.map((name, index) => {
    // Keep IDs stable when a section name is retained, or when its position
    // changes during a rename in a same-length list.
    let existing = existingSections.find(
      (section) =>
        !usedIds.has(section.id) &&
        normalizeSectionName(section.name).toLocaleLowerCase() === name.toLocaleLowerCase()
    );

    if (!existing && names.length === existingSections.length) {
      const atPosition = existingSections[index];
      if (atPosition && !usedIds.has(atPosition.id)) existing = atPosition;
    }

    if (existing) {
      usedIds.add(existing.id);
      return { ...existing, name };
    }

    return { id: createId(), name, active: true };
  });
};

const parseSectionNames = (text) => {
  const names = String(text ?? "")
    .split(",")
    .map(normalizeSectionName)
    .filter(Boolean);
  const seen = new Set();
  const duplicates = [];
  names.forEach((name) => {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) duplicates.push(name);
    seen.add(key);
  });
  return { names, duplicates };
};

function ClassesSections({ project, onSave, onContinue }) {
  const [classes, setClasses] = useState(() => normalizeClasses(project?.data?.classes));
  const [sectionMode, setSectionMode] = useState("bulk");
  const [bulkSectionNames, setBulkSectionNames] = useState("A, B");
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [customClassName, setCustomClassName] = useState("");
  const [classNameDrafts, setClassNameDrafts] = useState({});
  const [sectionDrafts, setSectionDrafts] = useState({});
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");

    const onSaveRef = useRef(onSave);
  const projectIdRef = useRef(project?.id);
  const pendingSaveRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const nextClasses = normalizeClasses(project?.data?.classes);
    setClasses(nextClasses);
    setSelectedClasses([]);
    setClassNameDrafts({});
    setSectionDrafts({});
    setNotice("");
    setNoticeType("info");
    projectIdRef.current = project?.id;
    initializedRef.current = true;
  }, [project?.id]);

    useEffect(() => {
    if (!initializedRef.current) return;
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timerId);
      pendingSaveRef.current = null;
    }

    const projectIdAtSchedule = project?.id;
    const payload = classes.map((item, index) => ({
      ...item,
      name: normalizeClassName(item.name),
      order: index + 1,
      sections: item.sections.map((section) => ({
        ...section,
        name: normalizeSectionName(section.name),
      })),
    }));
    const saveFn = onSaveRef.current;

    const timerId = setTimeout(() => {
      pendingSaveRef.current = null;
      if (projectIdRef.current !== projectIdAtSchedule) return;
      saveFn?.(payload);
    }, 500);

    pendingSaveRef.current = {
      timerId,
      payload,
      saveFn,
      projectId: projectIdAtSchedule,
    };

    return () => clearTimeout(timerId);
  }, [classes, project?.id]);

  useEffect(() => {
    return () => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      clearTimeout(pending.timerId);
      pendingSaveRef.current = null;
      if (pending.projectId === projectIdRef.current) {
        try {
          pending.saveFn?.(pending.payload);
        } catch {
          // Unmount cannot display a useful error.
        }
      }
    };
  }, []);

  const showNotice = (text, type = "info") => {
    setNotice(text);
    setNoticeType(type);
  };

  const isClassNameTaken = (name, exceptId = null) => {
    const key = normalizeClassName(name).toLocaleLowerCase();
    return classes.some(
      (item) => item.id !== exceptId && normalizeClassName(item.name).toLocaleLowerCase() === key
    );
  };

  function addClass(className) {
    const name = normalizeClassName(className);
    if (!name) {
      showNotice("Enter a class name first.", "error");
      return false;
    }
    if (isClassNameTaken(name)) {
      showNotice(`${name} is already added. Class names must be unique.`, "error");
      return false;
    }

    setClasses((previous) => [
      ...previous,
      { id: createId(), name, order: previous.length + 1, sections: [], active: true },
    ]);
    showNotice(`${name} added.`, "success");
    return true;
  }

  function addCustomClass() {
    if (addClass(customClassName)) setCustomClassName("");
  }

  function removeClass(classId) {
    const target = classes.find((item) => item.id === classId);
    if (!target) return;
    const confirmed = window.confirm(
      `Remove “${target.name}” and its sections? Existing mappings or timetable references to this class may need to be updated.`
    );
    if (!confirmed) return;

    setClasses((previous) =>
      previous
        .filter((item) => item.id !== classId)
        .map((item, index) => ({ ...item, order: index + 1 }))
    );
    setSelectedClasses((previous) => previous.filter((id) => id !== classId));
    setClassNameDrafts((previous) => {
      const next = { ...previous };
      delete next[classId];
      return next;
    });
    setSectionDrafts((previous) => {
      const next = { ...previous };
      delete next[classId];
      return next;
    });
    showNotice(`Removed ${target.name}. Review any dependent subject or timetable mappings.`, "success");
  }

  function toggleClassSelection(classId) {
    setSelectedClasses((previous) =>
      previous.includes(classId)
        ? previous.filter((id) => id !== classId)
        : [...previous, classId]
    );
  }

  function selectAllClasses() {
    setSelectedClasses(classes.map((item) => item.id));
    showNotice(`Selected all ${classes.length} class(es).`);
  }

  function clearSelection() {
    setSelectedClasses([]);
    showNotice("Selection cleared.");
  }

  function applySectionsToClasses(targetIds) {
    const { names, duplicates } = parseSectionNames(bulkSectionNames);
    const validTargetIds = targetIds.filter((id) => classes.some((item) => item.id === id));

    if (names.length === 0) {
      showNotice("Enter at least one section name.", "error");
      return;
    }
    if (duplicates.length) {
      showNotice(`Duplicate section name(s): ${[...new Set(duplicates)].join(", ")}.`, "error");
      return;
    }
    if (!validTargetIds.length) {
      showNotice("Select at least one class.", "error");
      return;
    }

    const targetSet = new Set(validTargetIds);
    setClasses((previous) =>
      previous.map((item) =>
        targetSet.has(item.id)
          ? { ...item, sections: makeSections(names, item.sections || []) }
          : item
      )
    );
    setSelectedClasses([]);
    showNotice(`Applied ${names.length} section(s) to ${validTargetIds.length} class(es).`, "success");
  }

  function updateClassNameDraft(classId, value) {
    setClassNameDrafts((previous) => ({ ...previous, [classId]: value }));
  }

  function commitClassName(classId) {
    const draft = classNameDrafts[classId];
    if (draft === undefined) return;
    const name = normalizeClassName(draft);
    const current = classes.find((item) => item.id === classId);
    if (!current) return;

    if (!name) {
      setClassNameDrafts((previous) => {
        const next = { ...previous };
        delete next[classId];
        return next;
      });
      showNotice("Class name cannot be blank. The previous name was retained.", "error");
      return;
    }
    if (isClassNameTaken(name, classId)) {
      setClassNameDrafts((previous) => {
        const next = { ...previous };
        delete next[classId];
        return next;
      });
      showNotice(`“${name}” already exists. The previous name was retained.`, "error");
      return;
    }

    setClasses((previous) =>
      previous.map((item) => (item.id === classId ? { ...item, name } : item))
    );
    setClassNameDrafts((previous) => {
      const next = { ...previous };
      delete next[classId];
      return next;
    });
    showNotice(`Class name updated to ${name}.`, "success");
  }

  function updateSectionsDraft(classId, value) {
    setSectionDrafts((previous) => ({ ...previous, [classId]: value }));
  }

  function commitSections(classId) {
    const draft = sectionDrafts[classId];
    if (draft === undefined) return;
    const { names, duplicates } = parseSectionNames(draft);
    if (duplicates.length) {
      showNotice(`Duplicate section name(s): ${[...new Set(duplicates)].join(", ")}. Changes not applied.`, "error");
      return;
    }

    setClasses((previous) =>
      previous.map((item) =>
        item.id === classId ? { ...item, sections: makeSections(names, item.sections || []) } : item
      )
    );
    setSectionDrafts((previous) => {
      const next = { ...previous };
      delete next[classId];
      return next;
    });
    showNotice(names.length ? `Sections updated (${names.length}).` : "Sections cleared for this class.", "success");
  }

  function moveClass(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= classes.length) return;
    setClasses((previous) => {
      const updated = [...previous];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated.map((item, position) => ({ ...item, order: position + 1 }));
    });
    showNotice("Class order updated.", "success");
  }

  const totalSections = classes.reduce((total, item) => total + item.sections.length, 0);
  const classesWithSections = classes.filter((item) => item.sections.length > 0).length;

  return (
    <div className="classes-page">
      <div className="classes-header">
        <div>
          <h1>Classes &amp; Sections</h1>
          <p>
            Add your school’s classes and assign sections. Use bulk setup for common sections
            or customise each class individually.
          </p>
        </div>
      </div>

      <div className="classes-summary">
        <div className="classes-summary-card">
          <span>Total Classes</span>
          <strong>{classes.length}</strong>
        </div>
        <div className="classes-summary-card">
          <span>Total Sections</span>
          <strong>{totalSections}</strong>
        </div>
        <div className="classes-summary-card">
          <span>Classes with Sections</span>
          <strong>{classesWithSections}</strong>
        </div>
      </div>

      <section className="classes-panel">
        <div className="classes-panel-heading">
          <div>
            <h2>1. Add Classes</h2>
            <p>Select the classes available in your school.</p>
          </div>
        </div>

        <div className="class-options">
          {CLASS_OPTIONS.map((name) => {
            const added = classes.some(
              (item) => normalizeClassName(item.name).toLocaleLowerCase() === name.toLocaleLowerCase()
            );
            return (
              <button
                key={name}
                type="button"
                className={`class-option ${added ? "added" : ""}`}
                onClick={() => addClass(name)}
                disabled={added}
                aria-pressed={added}
              >
                {added ? "✓ " : "+ "}{name}
              </button>
            );
          })}
        </div>

        <div className="custom-class-row">
          <input
            type="text"
            value={customClassName}
            onChange={(event) => setCustomClassName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomClass();
              }
            }}
            maxLength={80}
            placeholder="Enter a custom class name"
            aria-label="Custom class name"
          />
          <button type="button" onClick={addCustomClass}>Add Custom Class</button>
        </div>
      </section>

      <section className="classes-panel">
        <div className="classes-panel-heading">
          <div>
            <h2>2. Assign Sections</h2>
            <p>Choose a common setup or customise sections class-wise.</p>
          </div>
        </div>

        <div className="section-mode-buttons">
          <button
            type="button"
            className={sectionMode === "bulk" ? "mode-active" : ""}
            onClick={() => setSectionMode("bulk")}
            aria-pressed={sectionMode === "bulk"}
          >
            Same Sections for Multiple Classes
          </button>
          <button
            type="button"
            className={sectionMode === "individual" ? "mode-active" : ""}
            onClick={() => setSectionMode("individual")}
            aria-pressed={sectionMode === "individual"}
          >
            Customise Each Class
          </button>
        </div>

        {sectionMode === "bulk" && (
          <div className="bulk-section-area">
            <label htmlFor="bulk-sections">Section names (separate names with commas)</label>
            <input
              id="bulk-sections"
              type="text"
              value={bulkSectionNames}
              onChange={(event) => setBulkSectionNames(event.target.value)}
              maxLength={300}
              placeholder="Example: A, B, C"
            />
            <p className="classes-help">Examples: A, B | A, B, C | Red, Blue | North, South</p>

            <div className="selection-actions">
              <button type="button" onClick={selectAllClasses} disabled={!classes.length}>
                Select All Classes
              </button>
              <button type="button" onClick={clearSelection} disabled={!selectedClasses.length}>
                Clear Selection
              </button>
            </div>
            <p className="selection-count">{selectedClasses.length} class(es) selected</p>

            <button
              type="button"
              className="apply-sections-btn"
              onClick={() => applySectionsToClasses(selectedClasses)}
              disabled={!selectedClasses.length}
            >
              Apply to Selected Classes
            </button>
            <button
              type="button"
              className="apply-all-btn"
              onClick={() => applySectionsToClasses(classes.map((item) => item.id))}
              disabled={!classes.length}
            >
              Apply to All Classes
            </button>
          </div>
        )}

        {sectionMode === "individual" && (
          <p className="classes-help">
            Enter section names for each class below, separated by commas.
            Example: Class I: A, B; Class II: A; Class III: A, B, C, D.
            Changes are applied when you leave the field.
          </p>
        )}
      </section>

      <section className="classes-panel">
        <div className="classes-panel-heading">
          <div>
            <h2>3. Class-wise Configuration</h2>
            <p>Review class names, edit sections, and change the order.</p>
          </div>
        </div>

        {!classes.length ? (
          <div className="classes-empty">No classes added yet. Select classes above.</div>
        ) : (
          <div className="class-list">
            {classes.map((item, index) => {
              const classNameValue = classNameDrafts[item.id] ?? item.name;
              const sectionValue =
                sectionDrafts[item.id] ?? item.sections.map((section) => section.name).join(", ");
              return (
                <div className="class-config-card" key={item.id}>
                  <div className="class-config-top">
                    <input
                      type="checkbox"
                      className="class-select-checkbox"
                      checked={selectedClasses.includes(item.id)}
                      onChange={() => toggleClassSelection(item.id)}
                      aria-label={`Select ${item.name} for bulk section assignment`}
                    />
                    <span className="class-order">{index + 1}</span>
                    <input
                      className="class-name-input"
                      value={classNameValue}
                      maxLength={80}
                      onChange={(event) => updateClassNameDraft(item.id, event.target.value)}
                      onBlur={() => commitClassName(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setClassNameDrafts((previous) => {
                            const next = { ...previous };
                            delete next[item.id];
                            return next;
                          });
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label={`Class ${index + 1} name`}
                    />

                    <div className="class-actions">
                      <button
                        type="button"
                        onClick={() => moveClass(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                        aria-label={`Move ${item.name} up`}
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveClass(index, 1)}
                        disabled={index === classes.length - 1}
                        title="Move down"
                        aria-label={`Move ${item.name} down`}
                      >↓</button>
                      <button
                        type="button"
                        className="remove-class-btn"
                        onClick={() => removeClass(item.id)}
                        title="Remove class"
                      >Remove</button>
                    </div>
                  </div>

                  <div className="class-section-editor">
                    <label htmlFor={`sections-${item.id}`}>Sections</label>
                    <input
                      id={`sections-${item.id}`}
                      type="text"
                      value={sectionValue}
                      maxLength={300}
                      onChange={(event) => updateSectionsDraft(item.id, event.target.value)}
                      onBlur={() => commitSections(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setSectionDrafts((previous) => {
                            const next = { ...previous };
                            delete next[item.id];
                            return next;
                          });
                          event.currentTarget.blur();
                        }
                      }}
                      placeholder="Enter sections: A, B, C"
                    />

                    <div className="section-preview">
                      {!item.sections.length ? (
                        <span className="no-sections">No sections assigned</span>
                      ) : (
                        item.sections.map((section) => (
                          <span className="section-chip" key={section.id}>{section.name}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="classes-panel classes-preview-panel">
        <h2>4. Final Preview</h2>
        <p>Check your class and section structure before proceeding.</p>
        {!classes.length ? (
          <p>No classes configured.</p>
        ) : (
          <div className="classes-preview-list">
            {classes.map((item) => (
              <div className="classes-preview-row" key={item.id}>
                <strong>{item.name}</strong>
                <span>
                  {item.sections.length
                    ? item.sections.map((section) => section.name).join(", ")
                    : "Sections not assigned"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {notice && (
        <div className={`classes-notice ${noticeType}`} role={noticeType === "error" ? "alert" : "status"} aria-live="polite">
          {notice}
        </div>
      )}

      
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
        <div className="classes-save-note">
          <span>✓</span> Changes are saved automatically to this project.
        </div>

        <button
          type="button"
          className="apply-sections-btn"
          onClick={() => onContinue?.()}
          style={{ padding: "12px 22px" }}
        >
          Next: Subjects →
        </button>
      </div>
    </div>

  );
}

export default ClassesSections;
