
import { useEffect, useRef, useState } from "react";
import "../styles/classes-sections.css";

const CLASS_OPTIONS = [
  "Nursery", "LKG", "UKG",
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeSections(names, existingSections = []) {
  const usedIds = new Set();

  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => {
      // First, preserve the ID when the section name already exists.
      let existingSection = existingSections.find(
        (section) =>
          !usedIds.has(section.id) &&
          section.name.trim().toLowerCase() === name.toLowerCase()
      );

      // If renamed, preserve the ID at the same position when available.
      if (!existingSection && names.length === existingSections.length) {
  const sectionAtPosition = existingSections[index];

        if (
          sectionAtPosition &&
          !usedIds.has(sectionAtPosition.id)
        ) {
          existingSection = sectionAtPosition;
        }
      }

      if (existingSection) {
        usedIds.add(existingSection.id);

        return {
          ...existingSection,
          name,
        };
      }

      return {
        id: createId(),
        name,
        active: true,
      };
    });
}

function ClassesSections({ project, onSave }) {
  const savedClasses = project?.data?.classes || [];

  const [classes, setClasses] = useState(savedClasses);
  // Load classes from the selected school project when switching projects
useEffect(() => {
  setClasses(project?.data?.classes || []);
  setSelectedClasses([]);
  setNotice("");
}, [project?.id]);
  const [sectionMode, setSectionMode] = useState("bulk");
  const [bulkSectionNames, setBulkSectionNames] = useState("A, B");
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [customClassName, setCustomClassName] = useState("");
  const [notice, setNotice] = useState("");

  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Save this project's classes automatically.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current?.(classes);
    }, 500);

    return () => clearTimeout(timer);
  }, [classes, project?.id]);

  function addClass(className) {
    const name = className.trim();

    if (!name) return;

    const alreadyExists = classes.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      setNotice(`${name} is already added.`);
      return;
    }

    const newClass = {
      id: createId(),
      name,
      order: classes.length + 1,
      sections: [],
      active: true,
    };

    setClasses((previous) => [...previous, newClass]);
    setNotice(`${name} added successfully.`);
  }

  function addCustomClass() {
    if (!customClassName.trim()) {
      setNotice("Enter a class name first.");
      return;
    }

    addClass(customClassName);
    setCustomClassName("");
  }

  function removeClass(classId) {
    setClasses((previous) =>
      previous.filter((item) => item.id !== classId)
    );

    setSelectedClasses((previous) =>
      previous.filter((id) => id !== classId)
    );
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
  }

  function clearSelection() {
    setSelectedClasses([]);
  }

  
function applySectionsToClasses(targetIds) {
  const names = bulkSectionNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const uniqueNames = [
    ...new Set(names.map((name) => name.toLowerCase())),
  ];

  if (names.length === 0) {
    setNotice("Enter at least one section name.");
    return;
  }

  if (uniqueNames.length !== names.length) {
    setNotice("Duplicate section names are not allowed.");
    return;
  }

  if (targetIds.length === 0) {
    setNotice("Select at least one class.");
    return;
  }

  setClasses((previous) =>
    previous.map((item) =>
      targetIds.includes(item.id)
        ? {
    ...item,
    sections: makeSections(names, item.sections || []),
  }
        : item
    )
  );

  // Automatically clear selection after applying sections.
  setSelectedClasses([]);

  setNotice(`Sections applied to ${targetIds.length} class(es).`);
}


  function updateClassName(classId, newName) {
    setClasses((previous) =>
      previous.map((item) =>
        item.id === classId
          ? { ...item, name: newName }
          : item
      )
    );
  }

  function updateSections(classId, sectionText) {
  const names = sectionText
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const uniqueNames = [
    ...new Set(names.map((name) => name.toLowerCase())),
  ];

  if (uniqueNames.length !== names.length) {
    setNotice("Duplicate section names are not allowed.");
    return;
  }

  setClasses((previous) =>
    previous.map((item) =>
      item.id === classId
        ? {
            ...item,
            sections: makeSections(names, item.sections || []),
          }
        : item
    )
  );

  setNotice("");
}

  function moveClass(index, direction) {
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= classes.length) return;

    const updated = [...classes];
    [updated[index], updated[newIndex]] =
      [updated[newIndex], updated[index]];

    setClasses(
      updated.map((item, position) => ({
        ...item,
        order: position + 1,
      }))
    );
  }

  const totalSections = classes.reduce(
    (total, item) => total + item.sections.length,
    0
  );

  return (
    <div className="classes-page">
      <div className="classes-header">
        <div>
          <h1>Classes & Sections</h1>
          <p>
            Add your school's classes and assign sections.
            You can use bulk setup or customise each class separately.
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
          <strong>
            {classes.filter((item) => item.sections.length > 0).length}
          </strong>
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
              (item) => item.name.toLowerCase() === name.toLowerCase()
            );

            return (
              <button
                key={name}
                type="button"
                className={`class-option ${added ? "added" : ""}`}
                onClick={() => addClass(name)}
                disabled={added}
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
            placeholder="Enter a custom class name"
          />
          <button type="button" onClick={addCustomClass}>
            Add Custom Class
          </button>
        </div>
      </section>

      <section className="classes-panel">
        <div className="classes-panel-heading">
          <div>
            <h2>2. Assign Sections</h2>
            <p>
              Choose a quick common setup or customise sections class-wise.
            </p>
          </div>
        </div>

        <div className="section-mode-buttons">
          <button
            type="button"
            className={sectionMode === "bulk" ? "mode-active" : ""}
            onClick={() => setSectionMode("bulk")}
          >
            Same Sections for Multiple Classes
          </button>

          <button
            type="button"
            className={sectionMode === "individual" ? "mode-active" : ""}
            onClick={() => setSectionMode("individual")}
          >
            Customise Each Class
          </button>
        </div>

        {sectionMode === "bulk" && (
          <div className="bulk-section-area">
            <label htmlFor="bulk-sections">
              Section names (separate names with commas)
            </label>

            <input
              id="bulk-sections"
              type="text"
              value={bulkSectionNames}
              onChange={(event) =>
                setBulkSectionNames(event.target.value)
              }
              placeholder="Example: A, B, C"
            />

            <p className="classes-help">
              Examples: A, B | A, B, C | Red, Blue | North, South
            </p>

            <div className="selection-actions">
              <button type="button" onClick={selectAllClasses}>
                Select All Classes
              </button>

              <button type="button" onClick={clearSelection}>
                Clear Selection
              </button>
            </div>

            <p className="selection-count">
              {selectedClasses.length} class(es) selected
            </p>

            <button
              type="button"
              className="apply-sections-btn"
              onClick={() => applySectionsToClasses(selectedClasses)}
            >
              Apply to Selected Classes
            </button>

            <button
              type="button"
              className="apply-all-btn"
              onClick={() =>
                applySectionsToClasses(classes.map((item) => item.id))
              }
            >
              Apply to All Classes
            </button>
          </div>
        )}

        {sectionMode === "individual" && (
          <p className="classes-help">
            Enter section names for each class below, separated by commas.
            For example, Class I: A, B; Class II: A; Class III: A, B, C, D.
          </p>
        )}
      </section>

      <section className="classes-panel">
        <div className="classes-panel-heading">
          <div>
            <h2>3. Class-wise Configuration</h2>
            <p>
              Review class names, edit sections, and change the order.
            </p>
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="classes-empty">
            No classes added yet. Select classes in the section above.
          </div>
        ) : (
          <div className="class-list">
            {classes.map((item, index) => (
              <div className="class-config-card" key={item.id}>
                
<div className="class-config-top">
  <input
    type="checkbox"
    className="class-select-checkbox"
    checked={selectedClasses.includes(item.id)}
    onChange={() => toggleClassSelection(item.id)}
    aria-label={`Select ${item.name}`}
  />

  <span className="class-order">{index + 1}</span>


                  <input
                    className="class-name-input"
                    value={item.name}
                    onChange={(event) =>
                      updateClassName(item.id, event.target.value)
                    }
                    aria-label={`Class ${index + 1} name`}
                  />

                  <div className="class-actions">
                    <button
                      type="button"
                      onClick={() => moveClass(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => moveClass(index, 1)}
                      disabled={index === classes.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      className="remove-class-btn"
                      onClick={() => removeClass(item.id)}
                      title="Remove class"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="class-section-editor">
                  <label htmlFor={`sections-${item.id}`}>
                    Sections
                  </label>

                  <input
                    id={`sections-${item.id}`}
                    type="text"
                    value={item.sections.map((section) => section.name).join(", ")}
                    onChange={(event) =>
                      updateSections(item.id, event.target.value)
                    }
                    placeholder="Enter sections: A, B, C"
                  />

                  <div className="section-preview">
                    {item.sections.length === 0 ? (
                      <span className="no-sections">
                        No sections assigned
                      </span>
                    ) : (
                      item.sections.map((section) => (
                        <span className="section-chip" key={section.id}>
                          {section.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="classes-panel classes-preview-panel">
        <h2>4. Final Preview</h2>
        <p>Check your class and section structure before proceeding.</p>

        {classes.length === 0 ? (
          <p>No classes configured.</p>
        ) : (
          <div className="classes-preview-list">
            {classes.map((item) => (
              <div className="classes-preview-row" key={item.id}>
                <strong>{item.name}</strong>
                <span>
                  {item.sections.length > 0
                    ? item.sections.map((section) => section.name).join(", ")
                    : "Sections not assigned"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {notice && (
        <div className="classes-notice" role="status">
          {notice}
        </div>
      )}

      <div className="classes-save-note">
        <span>✓</span> Changes are saved automatically to this project.
      </div>
    </div>
  );
}

export default ClassesSections;
