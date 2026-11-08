import { useCallback, useEffect, useRef, useState } from "react";
import {
  School,
  MapPin,
  CalendarDays,
  Save,
  ArrowLeft,
  ArrowRight,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

import "../styles/school-setup.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AFFILIATIONS = [
  ["KVS", "Kendriya Vidyalaya Sangathan"],
  ["CBSE", "CBSE"],
  ["State Board", "State Board"],
  ["ICSE", "ICSE"],
  ["Other", "Other"],
];

function normalizeWorkingDays(days) {
  if (!Array.isArray(days)) return [...DAYS];
  const valid = DAYS.filter((day) => days.includes(day));
  return valid;
}

function buildForm(project) {
  const savedSchool = project?.data?.school && typeof project.data.school === "object"
    ? project.data.school
    : {};
  return {
    schoolName: String(project?.schoolName ?? savedSchool.schoolName ?? ""),
    affiliation: String(savedSchool.affiliation || "KVS"),
    schoolCode: String(savedSchool.schoolCode ?? ""),
    address: String(savedSchool.address ?? ""),
    district: String(savedSchool.district ?? ""),
    state: String(savedSchool.state || "Telangana"),
    pincode: String(savedSchool.pincode ?? "").replace(/\D/g, "").slice(0, 6),
    academicYear: String(project?.academicYear || "2026-27"),
    workingDays: normalizeWorkingDays(savedSchool.workingDays),
  };
}

function validateForm(form) {
  if (!form.schoolName.trim()) return "Please enter the school name.";
  if (!form.academicYear.trim()) return "Please select the academic year.";
  if (!Array.isArray(form.workingDays) || form.workingDays.length === 0) {
    return "Please select at least one working day.";
  }
  if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
    return "PIN code must contain exactly 6 digits.";
  }
  if (form.schoolCode.length > 40) return "School code must be 40 characters or fewer.";
  return "";
}

export default function SchoolSetup({ project, onUpdate, onContinue, onBack }) {
  const [form, setForm] = useState(() => buildForm(project));
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const onUpdateRef = useRef(onUpdate);
  const pendingRef = useRef(null);
  const dirtyRef = useRef(false);
  const formRef = useRef(form);
  const projectIdRef = useRef(project?.id);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const cancelPending = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timerId);
      pendingRef.current = null;
    }
  }, []);

  const commit = useCallback((data = formRef.current) => {
    cancelPending();
    try {
      onUpdateRef.current?.(data);
      dirtyRef.current = false;
      setSaveStatus("Saved");
      setLastSavedAt(new Date());
      setError("");
      return true;
    } catch (err) {
      setSaveStatus("Save failed");
      setError(err?.message || "Could not save changes. Please try again.");
      return false;
    }
  }, [cancelPending]);

  // Reset the form when a different project is selected; do not carry edits across projects.
  useEffect(() => {
    if (projectIdRef.current === project?.id) return;
    cancelPending();
    projectIdRef.current = project?.id;
    dirtyRef.current = false;
    const next = buildForm(project);
    formRef.current = next;
    setForm(next);
    setSaveStatus("Saved");
    setLastSavedAt(null);
    setError("");
  }, [project?.id, project, cancelPending]);

  // Debounced autosave. Save the latest immutable snapshot, not a stale render.
  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    setSaveStatus("Saving…");
    cancelPending();
    const snapshot = { ...form, workingDays: [...form.workingDays] };
    const timerId = setTimeout(() => {
      pendingRef.current = null;
      try {
        onUpdateRef.current?.(snapshot);
        dirtyRef.current = false;
        setSaveStatus("Saved");
        setLastSavedAt(new Date());
        setError("");
      } catch (err) {
        setSaveStatus("Save failed");
        setError(err?.message || "Could not save changes. Please try again.");
      }
    }, 600);
    pendingRef.current = { timerId, snapshot };
    return () => clearTimeout(timerId);
  }, [form, cancelPending]);

  // Ensure pending edits are committed if the user leaves this screen.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timerId);
        pendingRef.current = null;
        try {
          onUpdateRef.current?.(pending.snapshot);
        } catch {
          // Unmount cannot display a useful error; manual save remains available.
        }
      }
    };
  }, []);

  const updateField = useCallback((field, value) => {
    dirtyRef.current = true;
    setError("");
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleDay = useCallback((day) => {
    dirtyRef.current = true;
    setError("");
    setForm((prev) => {
      const selected = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: selected
          ? prev.workingDays.filter((item) => item !== day)
          : DAYS.filter((item) => item === day || prev.workingDays.includes(item)),
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    commit({ ...formRef.current, workingDays: [...formRef.current.workingDays] });
  }, [commit]);

  const handleBack = useCallback(() => {
    if (dirtyRef.current || pendingRef.current) handleSave();
    onBack?.();
  }, [handleSave, onBack]);

  const handleContinue = useCallback(() => {
    const validationMessage = validateForm(formRef.current);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (handleSave()) onContinue?.();
  }, [handleSave, onContinue]);

  const resetWorkingDays = () => {
    dirtyRef.current = true;
    setError("");
    updateField("workingDays", [...DAYS]);
  };

  const saving = saveStatus === "Saving…";

  return (
    <div className="school-setup-page">
      <div className="setup-header">
        <div>
          <div className="setup-eyebrow">PROJECT CONFIGURATION / STEP 1</div>
          <h1>School Setup</h1>
          <p>Enter your school’s basic information and academic details.</p>
        </div>
        <div className={`save-indicator ${saving ? "saving" : ""}`} aria-live="polite">
          {saveStatus === "Saved" ? <CheckCircle2 size={16} /> :
            saveStatus === "Save failed" ? <AlertCircle size={16} /> : <Cloud size={16} />}
          {saveStatus}
        </div>
      </div>

      <div className="setup-progress" aria-label="Setup progress">
        <div className="setup-progress-active" />
      </div>

      {error && (
        <div role="alert" className="setup-error-banner" style={{
          padding: "10px 14px", marginBottom: 16, background: "#fef2f2",
          border: "1px solid #fecaca", color: "#991b1b", borderRadius: 6, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <div className="setup-card">
        <div className="setup-card-heading">
          <div className="setup-icon"><School size={22} /></div>
          <div><h2>School Information</h2><p>Basic details of your institution.</p></div>
        </div>

        <div className="setup-form-grid">
          <div className="setup-field full-width">
            <label htmlFor="schoolName">School Name *</label>
            <input id="schoolName" value={form.schoolName}
              onChange={(e) => updateField("schoolName", e.target.value)}
              placeholder="Enter full school name" maxLength={160} required />
          </div>

          <div className="setup-field">
            <label htmlFor="affiliation">School Affiliation</label>
            <select id="affiliation" value={form.affiliation}
              onChange={(e) => updateField("affiliation", e.target.value)}>
              {AFFILIATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="setup-field">
            <label htmlFor="schoolCode">School Code (Optional)</label>
            <input id="schoolCode" value={form.schoolCode}
              onChange={(e) => updateField("schoolCode", e.target.value)}
              placeholder="Enter school code" maxLength={40} />
          </div>

          <div className="setup-field full-width">
            <label htmlFor="schoolAddress">School Address</label>
            <textarea id="schoolAddress" rows={3} value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Enter school address" maxLength={500} />
          </div>

          <div className="setup-field">
            <label htmlFor="district">District</label>
            <input id="district" value={form.district}
              onChange={(e) => updateField("district", e.target.value)}
              placeholder="Enter district" maxLength={100} />
          </div>

          <div className="setup-field">
            <label htmlFor="state">State</label>
            <input id="state" value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder="Enter state" maxLength={100} />
          </div>

          <div className="setup-field">
            <label htmlFor="pincode">PIN Code</label>
            <input id="pincode" value={form.pincode}
              onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit PIN code" inputMode="numeric" autoComplete="postal-code" maxLength={6} />
          </div>
        </div>
      </div>

      <div className="setup-card">
        <div className="setup-card-heading">
          <div className="setup-icon"><CalendarDays size={22} /></div>
          <div><h2>Academic Year</h2><p>Select the academic year for this timetable.</p></div>
        </div>
        <div className="setup-field">
          <label htmlFor="academicYear">Academic Year *</label>
          <select id="academicYear" value={form.academicYear}
            onChange={(e) => updateField("academicYear", e.target.value)}>
            {Array.from({ length: 10 }, (_, index) => {
              const start = 2026 + index;
              const value = `${start}-${String(start + 1).slice(-2)}`;
              return <option key={value} value={value}>{value}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="setup-card">
        <div className="setup-card-heading">
          <div className="setup-icon"><MapPin size={22} /></div>
          <div><h2>Working Days</h2><p>Select the days on which your school operates.</p></div>
        </div>
        <div className="working-days">
          {DAYS.map((day) => (
            <label className={`day-option ${form.workingDays.includes(day) ? "day-selected" : ""}`} key={day}>
              <input type="checkbox" checked={form.workingDays.includes(day)}
                onChange={() => toggleDay(day)} />
              <span>{day}</span>
            </label>
          ))}
        </div>
        <button type="button" className="setup-save-button" onClick={resetWorkingDays}
          style={{ marginTop: 12 }}><RotateCcw size={15} /> Restore Monday–Saturday</button>
      </div>

      <div className="setup-bottom">
        <button type="button" className="setup-back-button" onClick={handleBack}>
          <ArrowLeft size={17} /> Dashboard
        </button>
        <div className="setup-bottom-right">
          <button type="button" className="setup-save-button" onClick={handleSave} disabled={saving}>
            <Save size={17} /> Save
          </button>
          <button type="button" className="setup-continue-button" onClick={handleContinue}>
            Continue <ArrowRight size={17} />
          </button>
        </div>
      </div>
      {lastSavedAt && <p aria-live="polite" style={{ textAlign: "right", fontSize: 12, opacity: 0.7 }}>
        Last saved: {lastSavedAt.toLocaleTimeString()}
      </p>}
    </div>
  );
}
