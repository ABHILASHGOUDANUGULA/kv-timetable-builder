import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  getKVSSubjectsForClass,
} from "../data/kvsSubjectPresets";
import "../styles/subject-library.css";

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function normalizeSubject(subject) {
  return {
    ...subject,
    id: String(subject.id || createId()),
    name: String(subject.name || "").trim(),
    shortName: String(subject.shortName || "").trim(),
    active: subject.active !== false,
  };
}

function normalizeMapping(mapping) {
  const periods = Number(mapping.periodsPerWeek);
  const doubles = Number(mapping.doublePeriods);
  const normalizedPeriods =
    Number.isFinite(periods) && periods >= 0 ? Math.floor(periods) : 0;
  const normalizedDoubles =
    Number.isFinite(doubles) && doubles >= 0 ? Math.floor(doubles) : 0;
  return {
    ...mapping,
    id: String(mapping.id || createId()),
    classId: String(mapping.classId || ""),
    subjectId: String(mapping.subjectId || ""),
    periodsPerWeek: normalizedPeriods,
    doublePeriods: Math.min(
      normalizedDoubles,
      Math.floor(normalizedPeriods / 2)
    ),
  };
}

function SubjectLibrary({ project, onSave, onSaveMappings, onSaveOptionSets }) {
  // -------------------- State --------------------
  const [subjects, setSubjects] = useState(() =>
    safeArray(project?.data?.subjects).map(normalizeSubject)
  );
    const [mappings, setMappings] = useState(() =>
    safeArray(project?.data?.mappings).map(normalizeMapping)
  );
  const [optionSets, setOptionSets] = useState(() =>
    safeArray(project?.data?.optionSets)
  );
  const [newSetName, setNewSetName] = useState("");
  const [newSetClassId, setNewSetClassId] = useState("");
  const [newSetSubjects, setNewSetSubjects] = useState([]);
  const [newSetPeriods, setNewSetPeriods] = useState(1);

    const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [periodValues, setPeriodValues] = useState({});
  const [doubleValues, setDoubleValues] = useState({});

  const [subjectName, setSubjectName] = useState("");
  const [shortName, setShortName] = useState("");
  const [catalogueSelection, setCatalogueSelection] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState("");

  // -------------------- Save infrastructure --------------------
  const onSaveRef = useRef(onSave);
  const onSaveMappingsRef = useRef(onSaveMappings);
  const isFirstMount = useRef(true);
  const lastProjectIdRef = useRef(project?.id);

  // Two independent skip flags (one per save stream).
   const skipSubjectsSave = useRef(true);
  const skipMappingsSave = useRef(true);
  const skipOptionSetsSave = useRef(true);

  // Two independent pending-save records so unmount / project switch never
  // lose a debounced save and always write back to the project they belong to.
    const pendingSubjectsSaveRef = useRef(null);
  const pendingMappingsSaveRef = useRef(null);
  const pendingOptionSetsSaveRef = useRef(null);
  
  const onSaveOptionSetsRef = useRef(onSaveOptionSets);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

    useEffect(() => {
    onSaveMappingsRef.current = onSaveMappings;
  }, [onSaveMappings]);

  useEffect(() => {
    onSaveOptionSetsRef.current = onSaveOptionSets;
  }, [onSaveOptionSets]);

  // Flush pending saves BEFORE the new project's data replaces state.
  useLayoutEffect(() => {
    if (lastProjectIdRef.current === project?.id) return;
    lastProjectIdRef.current = project?.id;

    if (pendingSubjectsSaveRef.current) {
      clearTimeout(pendingSubjectsSaveRef.current.timerId);
      const { data, onSave: saveFn } = pendingSubjectsSaveRef.current;
      pendingSubjectsSaveRef.current = null;
      saveFn?.(data);
    }
    if (pendingMappingsSaveRef.current) {
      clearTimeout(pendingMappingsSaveRef.current.timerId);
      const { data, onSave: saveFn } = pendingMappingsSaveRef.current;
      pendingMappingsSaveRef.current = null;
      saveFn?.(data);
    }
  }, [project?.id]);

  // Reload data when the selected project changes.
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setSubjects(
      safeArray(project?.data?.subjects).map(normalizeSubject)
    );
        setMappings(
      safeArray(project?.data?.mappings).map(normalizeMapping)
    );
    setOptionSets(
      safeArray(project?.data?.optionSets)
    );

    setSelectedSubjectId("");
    setSelectedClassIds([]);
    setPeriodValues({});

    setSubjectName("");
    setShortName("");
    setCatalogueSelection("");
    setEditingId(null);
    setSearchText("");
    setShowArchived(false);
    setNotice("");

    // The next save-effect run (triggered by the state updates above) must
    // NOT persist the freshly loaded data back to the store.
        skipSubjectsSave.current = true;
    skipMappingsSave.current = true;
    skipOptionSetsSave.current = true;
  }, [project?.id]);

  // Save subjects (debounced).
  useEffect(() => {
    if (skipSubjectsSave.current) {
      skipSubjectsSave.current = false;
      return;
    }

    if (pendingSubjectsSaveRef.current) {
      clearTimeout(pendingSubjectsSaveRef.current.timerId);
      pendingSubjectsSaveRef.current = null;
    }

    const data = subjects;
    const saveFn = onSaveRef.current;
    const timerId = setTimeout(() => {
      pendingSubjectsSaveRef.current = null;
      saveFn?.(data);
    }, 500);

    pendingSubjectsSaveRef.current = { data, onSave: saveFn, timerId };
    return () => clearTimeout(timerId);
  }, [subjects]);

  // Save class-subject mappings (debounced).
  useEffect(() => {
    if (skipMappingsSave.current) {
      skipMappingsSave.current = false;
      return;
    }

    if (pendingMappingsSaveRef.current) {
      clearTimeout(pendingMappingsSaveRef.current.timerId);
      pendingMappingsSaveRef.current = null;
    }

    const data = mappings;
    const saveFn = onSaveMappingsRef.current;
    const timerId = setTimeout(() => {
      pendingMappingsSaveRef.current = null;
      saveFn?.(data);
    }, 500);

    pendingMappingsSaveRef.current = { data, onSave: saveFn, timerId };
    return () => clearTimeout(timerId);
  }, [mappings]);

        // Save option sets (debounced).
  useEffect(() => {
    if (skipOptionSetsSave.current) {
      skipOptionSetsSave.current = false;
      return;
    }
    if (pendingOptionSetsSaveRef.current) {
      clearTimeout(pendingOptionSetsSaveRef.current.timerId);
      pendingOptionSetsSaveRef.current = null;
    }
    const data = optionSets;
    const saveFn = onSaveOptionSetsRef.current;
    const timerId = setTimeout(() => {
      pendingOptionSetsSaveRef.current = null;
      saveFn?.(data);
    }, 500);
    pendingOptionSetsSaveRef.current = { data, onSave: saveFn, timerId };
    return () => clearTimeout(timerId);
  }, [optionSets]);

  // Flush any pending save on unmount so navigation never loses work.
  useEffect(() => {
    return () => {
      if (pendingSubjectsSaveRef.current) {
        clearTimeout(pendingSubjectsSaveRef.current.timerId);
        pendingSubjectsSaveRef.current.onSave?.(
          pendingSubjectsSaveRef.current.data
        );
        pendingSubjectsSaveRef.current = null;
      }
            if (pendingMappingsSaveRef.current) {
        clearTimeout(pendingMappingsSaveRef.current.timerId);
        pendingMappingsSaveRef.current.onSave?.(
          pendingMappingsSaveRef.current.data
        );
        pendingMappingsSaveRef.current = null;
      }
      if (pendingOptionSetsSaveRef.current) {
        clearTimeout(pendingOptionSetsSaveRef.current.timerId);
        pendingOptionSetsSaveRef.current.onSave?.(
          pendingOptionSetsSaveRef.current.data
        );
        pendingOptionSetsSaveRef.current = null;
      }
    };
  }, []);

  // -------------------- Derived data --------------------
  const classes = useMemo(() => {
    const raw = project?.data?.classes;
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.filter((c) => {
      if (!c || c.active === false || c.id == null || seen.has(String(c.id))) return false;
      seen.add(String(c.id));
      return true;
    }).map((c) => ({ ...c, id: String(c.id) }));
  }, [project?.data?.classes]);

  const affiliation = project?.data?.school?.affiliation || "KVS";
  const isKVS = affiliation === "KVS";

  const subjectCatalogue = useMemo(() => {
    if (!isKVS) return COMMON_SUBJECT_CATALOGUE;
    return Array.from(
      new Map(
        Object.values(KVS_SUBJECT_PRESETS)
          .flatMap((stage) => stage.subjects)
          .map((subject) => [subject.name, subject])
      ).values()
    );
  }, [isKVS]);

  const activeSubjects = useMemo(
    () => subjects.filter((s) => s.active !== false),
    [subjects]
  );

  const archivedSubjects = useMemo(
    () => subjects.filter((s) => s.active === false),
    [subjects]
  );

  const selectedSubject = useMemo(
    () => activeSubjects.find((s) => s.id === selectedSubjectId) || null,
    [activeSubjects, selectedSubjectId]
  );

  const displayedSubjects = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return subjects
      .filter((s) => (showArchived ? s.active === false : s.active !== false))
      .filter((s) => {
        if (!q) return true;
        return (
          String(s.name || "").toLowerCase().includes(q) ||
          String(s.shortName || "").toLowerCase().includes(q)
        );
      });
  }, [subjects, showArchived, searchText]);

  // -------------------- Helpers --------------------
  function getClassPreset(className) {
    if (!isKVS) return null;
    return getKVSSubjectsForClass(className);
  }

  function getPresetPeriods(className, subjectName_) {
    if (!isKVS || !className || !subjectName_) return 0;
    const preset = getClassPreset(className)?.subjects.find(
      (s) => s.name === subjectName_
    );
    return preset?.periods ?? 0;
  }

  /**
   * Resolve the effective weekly-period value for a class+subject pair
   * using the priority: user input → existing mapping → KVS preset → 0.
   * Returns a finite integer (floor) or "" when the user explicitly cleared
   * the field. The caller decides whether "" is acceptable.
   */
  function resolvePeriods(classId, existingMapping, subjectName_) {
    const raw = periodValues[classId];
    if (raw === "") return "";

    const fallback =
      existingMapping?.periodsPerWeek ??
      getPresetPeriods(
        classes.find((c) => c.id === classId)?.name,
        subjectName_
      ) ??
      0;

    const value = Number(raw ?? fallback);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  function resetForm() {
    setSubjectName("");
    setShortName("");
    setCatalogueSelection("");
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
    if (name.length > 100) {
      setNotice("Subject name must be 100 characters or fewer.");
      return;
    }
    if (short.length > 24) {
      setNotice("Short display name must be 24 characters or fewer.");
      return;
    }

    const nameLower = name.toLocaleLowerCase();
    const duplicate = subjects.some(
      (subject) =>
        String(subject.name || "").trim().toLocaleLowerCase() === nameLower &&
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
    setCatalogueSelection("");
    setNotice("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function cancelEditing() {
    resetForm();
    setNotice("");
  }

  function archiveSubject(subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) return;

    if (
      !window.confirm(
        `Archive "${subject.name}"? You can restore it later.`
      )
    )
      return;

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

    if (editingId === subjectId) resetForm();
    if (selectedSubjectId === subjectId) {
      setSelectedSubjectId("");
      setSelectedClassIds([]);
      setPeriodValues({});
    }

    setNotice(`${subject.name} archived successfully.`);
  }

  function restoreSubject(subjectId) {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) return;

    const nameLower = String(subject.name || "").trim().toLowerCase();
    const collision = subjects.some(
      (s) =>
        s.id !== subjectId &&
        s.active !== false &&
        String(s.name || "").trim().toLocaleLowerCase() === nameLower
    );

    if (collision) {
      setNotice(
        `Cannot restore "${subject.name}" — an active subject with this name already exists.`
      );
      return;
    }

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

  function handleCatalogueSelection(name) {
    setCatalogueSelection(name);

    if (!name) {
      setSubjectName("");
      setShortName("");
      return;
    }

    const selected = subjectCatalogue.find((subject) => subject.name === name);
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
    if (!Number.isFinite(n) || n < 0 || n > 60) return;
    setPeriodValues((previous) => ({ ...previous, [classId]: Math.floor(n) }));
  }

  function updateDoubleValue(classId, value) {
    if (value === "") {
      setDoubleValues((previous) => ({ ...previous, [classId]: "" }));
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 30) return;
    setDoubleValues((previous) => ({ ...previous, [classId]: Math.floor(n) }));
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

    const validSelectedClassIds = selectedClassIds.filter((id) =>
      classes.some((schoolClass) => schoolClass.id === id)
    );
    if (validSelectedClassIds.length === 0) {
      setNotice("Please select at least one active class.");
      return;
    }

    // Validate each selected class has a resolvable ≥1 period value.
    const invalidClass = validSelectedClassIds.find((classId) => {
      const existing = mappings.find(
        (item) =>
          item.classId === classId && item.subjectId === selectedSubjectId
      );
      const periods = resolvePeriods(
        classId,
        existing,
        selectedSubject?.name
      );
      return periods === "" || !Number.isInteger(periods) || periods < 1;
    });

        if (invalidClass) {
      setNotice(
        "Enter at least 1 whole period per week for every selected class."
      );
      return;
    }

    const invalidDoubles = validSelectedClassIds.find((classId) => {
      const existing = mappings.find(
        (item) =>
          item.classId === classId && item.subjectId === selectedSubjectId
      );
      const periods = resolvePeriods(
        classId,
        existing,
        selectedSubject?.name
      );
      const doubles =
        doubleValues[classId] !== undefined
          ? doubleValues[classId]
          : existing?.doublePeriods ?? 0;
      if (doubles === "") return false;
      if (!Number.isInteger(doubles) || doubles < 0) return true;
      return doubles * 2 > Number(periods);
    });

    if (invalidDoubles) {
      setNotice(
        "Double periods must be a whole number and 2 × doubles cannot exceed the weekly periods."
      );
      return;
    }

    setMappings((previous) => {
      const updated = [...previous];

      validSelectedClassIds.forEach((classId) => {
        const existingIndex = updated.findIndex(
          (item) =>
            item.classId === classId && item.subjectId === selectedSubjectId
        );
        const existing =
          existingIndex >= 0 ? updated[existingIndex] : null;
        const periods = resolvePeriods(
          classId,
          existing,
          selectedSubject?.name
        );

                const doubles =
          doubleValues[classId] !== undefined
            ? doubleValues[classId]
            : existing?.doublePeriods ?? 0;

        const mapping = {
          id: existing?.id || createId(),
          classId,
          subjectId: selectedSubjectId,
          periodsPerWeek: Number(periods),
          doublePeriods: Number(doubles) || 0,
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

      function handleAddOptionSet() {
    const name = newSetName.trim();
    const periods = Number(newSetPeriods);

    if (!newSetClassId || !name || newSetSubjects.length < 2 || periods < 1) {
      setNotice("Option sets need a class, a name, at least 2 subjects, and periods >= 1.");
      return;
    }

    // 1. Check if subjects are already part of an existing Option Set for this class
    const existingSetsForClass = optionSets.filter(s => s.classId === newSetClassId);
    for (const subId of newSetSubjects) {
      const existingSet = existingSetsForClass.find(s => s.subjectIds.includes(subId));
      if (existingSet) {
        const subName = subjects.find(s => s.id === subId)?.name;
        setNotice(`"${subName}" is already part of the "${existingSet.name}" Option Set.`);
        return;
      }
    }

    // 2. Check if the subjects are mapped to the class, and if their mapped periods match the Set's periods
    for (const subId of newSetSubjects) {
      const mapping = mappings.find(m => m.classId === newSetClassId && m.subjectId === subId);
      const subName = subjects.find(s => s.id === subId)?.name;

      if (!mapping) {
        setNotice(`"${subName}" is not mapped to this class yet. Assign it in the Subject–Class–Periods section first.`);
        return;
      }
      if (Number(mapping.periodsPerWeek) !== periods) {
        setNotice(`"${subName}" is mapped to ${mapping.periodsPerWeek} periods/week, but the Option Set is set to ${periods}. They must match.`);
        return;
      }
    }

    // Passed validation — create the set
    const newSet = {
      id: createId(),
      classId: newSetClassId,
      name: name,
      subjectIds: newSetSubjects,
      periodsPerWeek: periods,
      active: true,
      mutuallyExclusiveWith: []
    };

    setOptionSets((prev) => [...prev, newSet]);
    
    // Reset form
    setNewSetName("");
    setNewSetClassId("");
    setNewSetSubjects([]);
    setNewSetPeriods(1);
    setNotice(`${name} option set created.`);
  }

  function handleDeleteOptionSet(id, name) {
    if (!window.confirm(`Delete the "${name}" option set?`)) return;
    setOptionSets((prev) => prev.filter((s) => s.id !== id));
    setNotice(`Option set deleted.`);
  }

  function removeMapping(mapping, schoolClass, subject) {
    if (
      !window.confirm(
        `Remove ${subject.name} from Class ${schoolClass.name}?`
      )
    )
      return;

    setMappings((previous) =>
      previous.filter((item) => item.id !== mapping.id)
    );

    setNotice(`${subject.name} removed from Class ${schoolClass.name}.`);
  }

  // -------------------- Render --------------------
  return (
    <div className="subject-library-page">
      {/* HEADER */}
      <div className="subject-library-header">
        <div>
          <h1>Subject Library</h1>
          <p>Create and manage all subjects offered by your school.</p>
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
            <h2>{editingId ? "Edit Subject" : "Add New Subject"}</h2>
            <p>Enter the full name. A short display name is optional.</p>
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
          <div
            className="subject-form-field"
            style={{ marginBottom: "18px" }}
          >
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
                onChange={(event) => setSubjectName(event.target.value)}
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
                onChange={(event) => setShortName(event.target.value)}
                placeholder="Example: Maths"
              />

              <small>
                Used when the administrator chooses a compact timetable.
              </small>
            </div>
          </div>

          <div className="subject-form-actions">
            <button type="submit" className="subject-primary-btn">
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
              Select a subject, choose the classes where it is taught, and
              enter the weekly periods for each class.
            </p>
          </div>
        </div>

        <div className="subject-form-field">
          <label htmlFor="mapping-subject">Select Subject *</label>

          <select
            id="mapping-subject"
            value={selectedSubjectId}
                        onChange={(event) => {
              setSelectedSubjectId(event.target.value);
              setSelectedClassIds([]);
              setPeriodValues({});
              setDoubleValues({});
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
                Select each class and enter the required number of periods
                per week.
              </p>
            </div>

            {classes.length > 0 && (
              <div className="subject-form-actions" style={{ margin: "12px 0" }}>
                <button
                  type="button"
                  className="subject-secondary-btn"
                  onClick={() => setSelectedClassIds(classes.map((item) => item.id))}
                >
                  Select All Classes
                </button>
                <button
                  type="button"
                  className="subject-secondary-btn"
                  onClick={() => setSelectedClassIds([])}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {classes.length === 0 ? (
              <p className="subject-assignment-empty">
                No active classes found. Add classes in Classes &amp;
                Sections first.
              </p>
            ) : (
              <div className="subject-assignment-grid">
                {classes.map((schoolClass) => {
                  const existingMapping = mappings.find(
                    (item) =>
                      item.classId === schoolClass.id &&
                      item.subjectId === selectedSubjectId
                  );
                  const presetPeriods = getPresetPeriods(
                    schoolClass.name,
                    selectedSubject?.name
                  );
                  const isSelected = selectedClassIds.includes(
                    schoolClass.id
                  );

                  const displayValue =
                    periodValues[schoolClass.id] !== undefined
                      ? periodValues[schoolClass.id]
                      : existingMapping?.periodsPerWeek ??
                        (presetPeriods || 0);

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
                        <label>Periods per week</label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="1"
                          inputMode="numeric"
                          value={displayValue}
                          onChange={(event) =>
                            updatePeriodValue(
                              schoolClass.id,
                              event.target.value
                            )
                          }
                        />
                      </div>

                      <div className="subject-period-field">
                        <label>Double periods per week (labs / practicals)</label>
                        <input
                          type="number"
                          min="0"
                          max={Math.floor(Number(displayValue) / 2) || 0}
                          step="1"
                          inputMode="numeric"
                          value={
                            doubleValues[schoolClass.id] !== undefined
                              ? doubleValues[schoolClass.id]
                              : existingMapping?.doublePeriods ?? 0
                          }
                          onChange={(event) =>
                            updateDoubleValue(
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

            {/* OPTION SETS (PARALLEL SUBJECTS) */}
      <section className="subject-panel">
        <div className="subject-panel-heading">
          <div>
            <h2>Option Sets (Parallel Subjects)</h2>
            <p>
              Group subjects that run at the same time. For example, create a "Sci-Elective" set 
              with Math and Biology, so students split into different rooms during that period.
            </p>
          </div>
        </div>

        <div className="option-set-creator">
          <div className="subject-form-grid" style={{ marginBottom: "15px" }}>
            <div className="subject-form-field">
              <label>Select Class</label>
              <select value={newSetClassId} onChange={(e) => setNewSetClassId(e.target.value)}>
                <option value="">Choose a class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div className="subject-form-field">
              <label>Set Name</label>
              <input 
                type="text" 
                placeholder="e.g. R3 or Sci-Elective" 
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>

          {newSetClassId && (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>Select Subjects in this Set</label>
                            <div className="option-set-subject-picker">
                {activeSubjects.map((sub) => {
                  const mappedPeriods = mappings.find(m => m.classId === newSetClassId && m.subjectId === sub.id)?.periodsPerWeek || 0;
                  return (
                    <label key={sub.id} className="option-set-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newSetSubjects.includes(sub.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSetSubjects(prev => [...prev, sub.id]);
                            // Auto-fill the periods if they match the mapping
                            if (mappedPeriods > 0) setNewSetPeriods(mappedPeriods);
                          } else {
                            setNewSetSubjects(prev => prev.filter(id => id !== sub.id));
                          }
                        }}
                      />
                      {sub.name} <span style={{ color: '#64748b', fontSize: '11px' }}>({mappedPeriods} p/w)</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="subject-form-field" style={{ maxWidth: "200px", marginBottom: "15px" }}>
            <label>Periods per week</label>
            <input 
              type="number" 
              min="1" 
              max="20"
              value={newSetPeriods}
              onChange={(e) => setNewSetPeriods(e.target.value)}
            />
          </div>

          <button type="button" className="subject-primary-btn" onClick={handleAddOptionSet}>
            <Plus size={16} /> Create Option Set
          </button>
        </div>

        {optionSets.length > 0 && (
          <div style={{ marginTop: "30px" }}>
            <h3 style={{ fontSize: "15px", marginBottom: "15px" }}>Active Option Sets</h3>
            <div className="option-set-list">
              {optionSets.map((set) => {
                const clsName = classes.find(c => c.id === set.classId)?.name || "Unknown Class";
                const subNames = set.subjectIds.map(id => subjects.find(s => s.id === id)?.name).join(" + ");
                return (
                  <div key={set.id} className="option-set-card">
                    <div>
                      <strong>{set.name}</strong> ({clsName})
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                        Subjects: {subNames} | {set.periodsPerWeek} periods/week
                      </div>
                    </div>
                    <button type="button" className="subject-archive-btn" onClick={() => handleDeleteOptionSet(set.id, set.name)}>
                      <X size={15} /> Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* CLASS-WISE SUBJECT REVIEW */}
      <section className="subject-panel">
        <div className="subject-panel-heading">
          <div>
            <h2>Class-wise Subject &amp; Period Review</h2>
            <p>
              Review the subjects assigned to each class and their weekly
              period requirements.
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
                    <span>{classMappings.length} subject(s)</span>
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
                                      {" "}
                                      (Archived)
                                    </span>
                                  )}
                                </td>

                                <td>{mapping.periodsPerWeek ?? 0}</td>

                                <td>
                                  <button
                                    type="button"
                                    className="subject-archive-btn"
                                    onClick={() =>
                                      removeMapping(
                                        mapping,
                                        schoolClass,
                                        subject
                                      )
                                    }
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
            <h2>{showArchived ? "Archived Subjects" : "Subject List"}</h2>
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
            {showArchived ? "View Active Subjects" : "View Archived"}
          </button>
        </div>

        <div className="subject-search">
          <Search size={18} />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
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
                    <td className="subject-full-name">{subject.name}</td>
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
                            onClick={() => restoreSubject(subject.id)}
                          >
                            <RotateCcw size={15} />
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="subject-edit-btn"
                              onClick={() => startEditing(subject)}
                              title="Edit subject"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="subject-archive-btn"
                              onClick={() => archiveSubject(subject.id)}
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
        Changes are saved automatically to this school project. Assignments require at least 1 period/week; maximum 60.
      </div>
    </div>
  );
}

export default SubjectLibrary;