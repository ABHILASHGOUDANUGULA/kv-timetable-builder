
import { useEffect, useRef, useState } from "react";
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
  return input
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
  const [teachers, setTeachers] = useState(
    project?.data?.teachers || []
  );

  const [bulkInput, setBulkInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");

  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Automatically save teachers to the current project.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current?.(teachers);
    }, 500);

    return () => clearTimeout(timer);
  }, [teachers, project?.id]);

  const preview = parseTeacherInput(bulkInput);

  const activeTeachers = teachers.filter(
    (teacher) => teacher.active !== false
  );

  const archivedTeachers = teachers.filter(
    (teacher) => teacher.active === false
  );

  const displayedTeachers = teachers
    .filter((teacher) =>
      showArchived
        ? teacher.active === false
        : teacher.active !== false
    )
    .filter((teacher) =>
      `${teacher.name} ${teacher.nickname || ""}`
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );

  const duplicateNames = preview.filter((teacher, index) => {
    const normalized = teacher.name.toLowerCase();

    return (
      preview.findIndex(
        (item) => item.name.toLowerCase() === normalized
      ) !== index ||
      teachers.some(
        (existing) =>
          existing.active !== false &&
          existing.name.toLowerCase() === normalized
      )
    );
  });

  const invalidEntries = preview.filter(
    (teacher) => !teacher.name || !teacher.nickname
  );

  const validCount =
    preview.length -
    duplicateNames.length -
    invalidEntries.length;

  function addTeachers() {
    if (preview.length === 0) {
      setNotice("Please enter teacher names first.");
      return;
    }

    const existingNames = new Set(
      teachers
        .filter((teacher) => teacher.active !== false)
        .map((teacher) => teacher.name.toLowerCase())
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
    }

    setBulkInput("");

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
  }

  function saveEdit() {
    const name = editName.trim();
    const nickname = editNickname.trim();

    if (!name || !nickname) {
      setNotice("Both teacher name and nickname are required.");
      return;
    }

    const duplicate = teachers.some(
      (teacher) =>
        teacher.id !== editingId &&
        teacher.name.toLowerCase() === name.toLowerCase() &&
        teacher.active !== false
    );

    if (duplicate) {
      setNotice("This teacher name already exists.");
      return;
    }

    setTeachers((previous) =>
      previous.map((teacher) =>
        teacher.id === editingId
          ? {
              ...teacher,
              name,
              nickname,
              updatedAt: new Date().toISOString(),
            }
          : teacher
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
    ) return;

    setTeachers((previous) =>
      previous.map((item) =>
        item.id === teacher.id
          ? { ...item, active: false }
          : item
      )
    );

    setNotice(`${teacher.name} archived.`);
  }

  function restoreTeacher(teacher) {
    setTeachers((previous) =>
      previous.map((item) =>
        item.id === teacher.id
          ? { ...item, active: true }
          : item
      )
    );

    setNotice(`${teacher.name} restored.`);
  }

  return (
    <div className="teacher-library-page">

      <div className="teacher-library-header">
        <div>
          <h1>Teacher Library</h1>
          <p>
            Add and manage all teachers in your school.
          </p>
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
            <p>
              Copy and paste your complete teacher list into one box.
            </p>
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
          Separate teachers using commas or new lines.
          Use NAME-NICKNAME format.
        </div>

        {preview.length > 0 && (
          <>
            <div className="teacher-preview-summary">
              <strong>{preview.length} entries detected</strong>
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
                  {preview.map((teacher, index) => {
                    const invalid =
                      !teacher.name || !teacher.nickname;

                    const duplicate = duplicateNames.some(
                      (item) =>
                        item.name.toLowerCase() ===
                        teacher.name.toLowerCase()
                    );

                    return (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{teacher.name || "Missing name"}</td>
                        <td>{teacher.nickname || "Missing nickname"}</td>
                        <td>
                          {invalid ? (
                            <span className="teacher-status-error">
                              Incomplete
                            </span>
                          ) : duplicate ? (
                            <span className="teacher-status-error">
                              Duplicate
                            </span>
                          ) : (
                            <span className="teacher-status-valid">
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
            <h2>
              {showArchived ? "Archived Teachers" : "Teacher List"}
            </h2>
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

                    {editingId === teacher.id ? (
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
                        <td className="teacher-full-name">
                          {teacher.name}
                        </td>
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
