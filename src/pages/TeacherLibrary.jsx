import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Archive,
  RotateCcw,
  X,
  Check,
  UserPlus,
} from "lucide-react";

import "../styles/teacher-library.css";

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function parseTeacherInput(input) {
  return String(input || "")
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.lastIndexOf("-");

      if (separator === -1) {
        return {
          name: entry.trim(),
          nickname: "",
        };
      }

      return {
        name: entry.slice(0, separator).trim(),
        nickname: entry.slice(separator + 1).trim(),
      };
    });
}

function TeacherLibrary({ project, onSave }) {
  const [teachers, setTeachers] = useState(() =>
    Array.isArray(project?.data?.teachers) ? project.data.teachers.map((t) => ({ ...t, id: String(t.id ?? createId()), name: String(t.name ?? "").trim(), nickname: String(t.nickname ?? "").trim(), active: t.active !== false })) : []
  );

  const [bulkInput, setBulkInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved");

  // -------------------- Save infrastructure --------------------
  const onSaveRef = useRef(onSave);
  const isFirstRender = useRef(true);
  const isFirstMount = useRef(true);
  const lastProjectIdRef = useRef(project?.id);
  const pendingSaveRef = useRef(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Flush any pending debounced save BEFORE the project switch resets state.
  // Runs in the layout phase so it always fires before passive effects.
  useLayoutEffect(() => {
    if (lastProjectIdRef.current === project?.id) return;

    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timerId);
      const { data, onSave: saveFn } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try { Promise.resolve(saveFn?.(data)).then(() => setSaveStatus("Saved")).catch(() => setSaveStatus("Save failed")); } catch { setSaveStatus("Save failed"); }
    }

    lastProjectIdRef.current = project?.id;
  }, [project?.id]);

  // Reload data when the selected project changes (defensive — the parent
  // normally uses key remount, but this keeps the component robust if that
  // ever changes).
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setTeachers(
      Array.isArray(project?.data?.teachers) ? project.data.teachers.map((t) => ({ ...t, id: String(t.id ?? createId()), name: String(t.name ?? "").trim(), nickname: String(t.nickname ?? "").trim(), active: t.active !== false })) : []
    );
    setBulkInput("");
    setSearchText("");
    setShowArchived(false);
    setNotice("");
    setSaveStatus("Saved");
    setEditingId(null);
    setEditName("");
    setEditNickname("");

    // The next state-triggered save would persist the freshly loaded data
    // back to the store; skip it.
    isFirstRender.current = true;
  }, [project?.id]);

  // Debounced auto-save with unmount flush.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Defensive — earlier cleanup should have already cleared this.
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timerId);
      pendingSaveRef.current = null;
    }

    const data = teachers;
    const saveFn = onSaveRef.current;
    setSaveStatus("Saving…");
    const timerId = setTimeout(() => {
      pendingSaveRef.current = null;
      try {
        Promise.resolve(saveFn?.(data)).then(() => setSaveStatus("Saved")).catch(() => setSaveStatus("Save failed"));
      } catch {
        setSaveStatus("Save failed");
      }
    }, 500);

    pendingSaveRef.current = { data, onSave: saveFn, timerId };

    return () => clearTimeout(timerId);
  }, [teachers]);

  // Flush any pending save on unmount so navigation never loses work.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current.timerId);
        try { pendingSaveRef.current.onSave?.(pendingSaveRef.current.data); } catch { /* parent save error */ }
        pendingSaveRef.current = null;
      }
    };
  }, []);

  // -------------------- Derived data --------------------
  const preview = useMemo(() => parseTeacherInput(bulkInput), [bulkInput]);

  const previewRows = useMemo(() => {
    return preview.map((entry, index) => {
      if (!entry.name || !entry.nickname) {
        return { ...entry, status: "Incomplete" };
      }

      const normalized = entry.name.trim().toLocaleLowerCase();
      const isDuplicateInPreview =
        preview.findIndex(
          (t) => String(t.name || "").trim().toLocaleLowerCase() === normalized
        ) !== index;
      const isExisting = teachers.some(
        (t) =>
          t.active !== false &&
          String(t.name || "").trim().toLowerCase() === normalized
      );

      return {
        ...entry,
        status: isDuplicateInPreview || isExisting ? "Duplicate" : "Valid",
      };
    });
  }, [preview, teachers]);

  const validCount = useMemo(
    () => previewRows.filter((r) => r.status === "Valid").length,
    [previewRows]
  );

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.active !== false),
    [teachers]
  );

  const archivedTeachers = useMemo(
    () => teachers.filter((t) => t.active === false),
    [teachers]
  );

  const displayedTeachers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return teachers
      .filter((t) => (showArchived ? t.active === false : t.active !== false))
      .filter((t) => {
        if (!q) return true;
        const haystack = `${t.name || ""} ${t.nickname || ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
  }, [teachers, showArchived, searchText]);

  // -------------------- Actions --------------------
  function addTeachers() {
    if (preview.length === 0) {
      setNotice("Please enter teacher names first.");
      return;
    }

    const existingNames = new Set(
      teachers
        .filter((t) => t.active !== false)
        .map((t) => String(t.name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const added = [];
    const skipped = [];

    preview.forEach((teacher) => {
      const name = teacher.name.trim();
      const nickname = teacher.nickname.trim();
      const key = name.toLowerCase();

      if (!name || !nickname || existingNames.has(key)) {
        skipped.push(name || "Invalid entry");
        return;
      }

      existingNames.add(key);

      added.push({
        id: createId(),
        name,
        nickname,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (added.length > 0) {
      setTeachers((previous) => [...previous, ...added]);
      // Only clear input when something was actually added — otherwise the
      // user loses their work-in-progress list.
      setBulkInput("");
    }

    setNotice(
      `${added.length} teacher(s) added successfully.` +
        (skipped.length
          ? ` ${skipped.length} entry/entries skipped.`
          : "")
    );
  }

  function startEditing(teacher) {
    setEditingId(teacher.id);
    setEditName(teacher.name);
    setEditNickname(teacher.nickname || "");
    setNotice("");
  }

  function saveEdit() {
    const name = editName.trim();
    const nickname = editNickname.trim();

    if (!name || !nickname) {
      setNotice("Both teacher name and nickname are required.");
      return;
    }

    const duplicate = teachers.some(
      (t) =>
        String(t.id) !== String(editingId) &&
        t.active !== false &&
        String(t.name || "").trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setNotice("This teacher name already exists.");
      return;
    }

    setTeachers((previous) =>
      previous.map((t) =>
        String(t.id) === String(editingId)
          ? {
              ...t,
              name,
              nickname,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );

    setEditingId(null);
    setNotice(`${name} updated successfully.`);
  }

  function archiveTeacher(teacher) {
    if (
      !window.confirm(
        `Archive ${teacher.name}? You can restore this teacher later.`
      )
    )
      return;

    setTeachers((previous) =>
      previous.map((t) =>
        String(t.id) === String(teacher.id) ? { ...t, active: false, updatedAt: new Date().toISOString() } : t
      )
    );

    setNotice(`${teacher.name} archived.`);
  }

  function restoreTeacher(teacher) {
    const nameLower = String(teacher.name || "").trim().toLowerCase();
    const collision = teachers.some(
      (t) =>
        String(t.id) !== String(teacher.id) &&
        t.active !== false &&
        String(t.name || "").trim().toLowerCase() === nameLower
    );

    if (collision) {
      setNotice(
        `Cannot restore "${teacher.name}" — an active teacher with this name already exists.`
      );
      return;
    }

    setTeachers((previous) =>
      previous.map((t) => (String(t.id) === String(teacher.id) ? { ...t, active: true, updatedAt: new Date().toISOString() } : t))
    );

    setNotice(`${teacher.name} restored.`);
  }

  // -------------------- Render --------------------
  return (
    <div className="teacher-library-page">
      <div className="teacher-library-header">
        <div>
          <h1>Teacher Library</h1>
          <p>Add and manage all teachers in your school.</p>
        </div>

        <div className="teacher-library-project">
          <Users size={18} />
          <span>{project?.schoolName || "Current School"}</span>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="teacher-library-stats">
        <div className="teacher-stat-card">
          <span>Active Teachers</span>
          <strong>{activeTeachers.length}</strong>
        </div>

        <div className="teacher-stat-card">
          <span>Archived Teachers</span>
          <strong>{archivedTeachers.length}</strong>
        </div>

        <div className="teacher-stat-card">
          <span>Total Teachers</span>
          <strong>{teachers.length}</strong>
        </div>
      </div>

      {/* BULK ADDITION */}
      <section className="teacher-panel">
        <div className="teacher-panel-heading">
          <div>
            <h2>
              <UserPlus size={20} />
              Add Multiple Teachers
            </h2>
            <p>Copy and paste your complete teacher list into one box.</p>
          </div>
        </div>

        <label htmlFor="teacher-bulk-input">
          Teacher Names and Nicknames *
        </label>

        <textarea
          id="teacher-bulk-input"
          value={bulkInput}
          onChange={(event) => setBulkInput(event.target.value)}
          placeholder={
            "ABHILASH-AG, RAMYA-RM, RAVI CHANDRA-RC\nSUNITHA-RS, JYOTHI-JY"
          }
          rows={6}
        />

        <div className="teacher-input-help">
          Separate teachers using commas or new lines. Use NAME-NICKNAME format.
        </div>

        {previewRows.length > 0 && (
          <>
            <div className="teacher-preview-summary">
              <strong>{previewRows.length} entries detected</strong>
              <span>{validCount} valid entries</span>
            </div>

            <div className="teacher-preview-table-wrapper">
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th>Sl. No.</th>
                    <th>Full Name</th>
                    <th>Nickname</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map((teacher, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{teacher.name || "Missing name"}</td>
                      <td>{teacher.nickname || "Missing nickname"}</td>
                      <td>
                        {teacher.status === "Incomplete" ? (
                          <span className="teacher-status-error">
                            Incomplete
                          </span>
                        ) : teacher.status === "Duplicate" ? (
                          <span className="teacher-status-error">
                            Duplicate
                          </span>
                        ) : (
                          <span className="teacher-status-valid">Valid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="teacher-form-actions">
          <button
            type="button"
            className="teacher-primary-btn"
            onClick={addTeachers}
            disabled={validCount <= 0}
          >
            <Plus size={17} />
            Add All {validCount} Teachers
          </button>

          <button
            type="button"
            className="teacher-secondary-btn"
            onClick={() => setBulkInput("")}
          >
            Clear Text Box
          </button>
        </div>
      </section>

      {/* TEACHER LIST */}
      <section className="teacher-panel">
        <div className="teacher-list-heading">
          <div>
            <h2>{showArchived ? "Archived Teachers" : "Teacher List"}</h2>
            <p>Search and manage your teacher records.</p>
          </div>

          <button
            type="button"
            className="teacher-view-toggle"
            onClick={() => {
              setShowArchived((previous) => !previous);
              setSearchText("");
              setEditingId(null);
            }}
          >
            {showArchived ? "View Active" : "View Archived"}
          </button>
        </div>

        <div className="teacher-search">
          <Search size={18} />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search teacher name or nickname..."
          />
        </div>

        {displayedTeachers.length === 0 ? (
          <div className="teacher-empty-state">
            <Users size={30} />
            <h3>No teachers found</h3>
            <p>Add teachers using the bulk-entry box above.</p>
          </div>
        ) : (
          <div className="teacher-table-wrapper">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>Sl. No.</th>
                  <th>Full Name</th>
                  <th>Nickname</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {displayedTeachers.map((teacher, index) => (
                  <tr key={teacher.id}>
                    <td>{index + 1}</td>

                    {String(editingId) === String(teacher.id) ? (
                      <>
                        <td>
                          <input
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={editNickname}
                            onChange={(event) =>
                              setEditNickname(event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="teacher-edit-btn"
                          >
                            <Check size={15} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="teacher-archive-btn"
                          >
                            <X size={15} /> Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="teacher-full-name">{teacher.name}</td>
                        <td>
                          <span className="teacher-nickname">
                            {teacher.nickname}
                          </span>
                        </td>
                        <td>
                          <div className="teacher-row-actions">
                            {showArchived ? (
                              <button
                                type="button"
                                className="teacher-restore-btn"
                                onClick={() => restoreTeacher(teacher)}
                              >
                                <RotateCcw size={15} /> Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="teacher-edit-btn"
                                  onClick={() => startEditing(teacher)}
                                >
                                  <Pencil size={15} /> Edit
                                </button>

                                <button
                                  type="button"
                                  className="teacher-archive-btn"
                                  onClick={() => archiveTeacher(teacher)}
                                >
                                  <Archive size={15} /> Archive
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {notice && (
        <div className="teacher-notice" role="status">
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

      <div className="teacher-auto-save">
        <Check size={16} />
        Changes are saved automatically to this school project.
      </div>
    </div>
  );
}

export default TeacherLibrary;