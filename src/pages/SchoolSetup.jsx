
import { useEffect, useState } from "react";
import {
  School,
  MapPin,
  CalendarDays,
  Save,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
} from "lucide-react";

import "../styles/school-setup.css";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function SchoolSetup({
  project,
  onUpdate,
  onContinue,
  onBack,
}) {
  const saved = project.data?.school || {};

  const [form, setForm] = useState({
    schoolName: project.schoolName || "",
    affiliation: saved.affiliation || "KVS",
    schoolCode: saved.schoolCode || "",
    address: saved.address || "",
    district: saved.district || "",
    state: saved.state || "Telangana",
    pincode: saved.pincode || "",
    academicYear: project.academicYear || "2026-27",
    workingDays: saved.workingDays || [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
  });
// Synchronize form data when switching to another school project
useEffect(() => {
  const savedSchool = project.data?.school || {};

  setForm({
    schoolName: project.schoolName || "",
    affiliation: savedSchool.affiliation || "KVS",
    schoolCode: savedSchool.schoolCode || "",
    address: savedSchool.address || "",
    district: savedSchool.district || "",
    state: savedSchool.state || "Telangana",
    pincode: savedSchool.pincode || "",
    academicYear: project.academicYear || "2026-27",
    workingDays: Array.isArray(savedSchool.workingDays)
      ? savedSchool.workingDays
      : [...DAYS],
  });
}, [project.id]);
  const [saveStatus, setSaveStatus] = useState("Saved");

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function toggleDay(day) {
    setForm((previous) => {
      const exists = previous.workingDays.includes(day);

      return {
        ...previous,
        workingDays: exists
          ? previous.workingDays.filter((d) => d !== day)
          : [...previous.workingDays, day],
      };
    });
  }

  // Automatic saving after the user stops typing
  useEffect(() => {
    setSaveStatus("Saving...");

    const timer = setTimeout(() => {
      onUpdate(form);
      setSaveStatus("Saved");
    }, 700);

    return () => clearTimeout(timer);
  }, [form]);

  // Manual save
  function handleManualSave() {
    onUpdate(form);
    setSaveStatus("Saved");
  }

  function handleContinue() {
    if (!form.schoolName.trim()) {
      alert("Please enter the school name.");
      return;
    }

    if (form.workingDays.length === 0) {
      alert("Please select at least one working day.");
      return;
    }

    onUpdate(form);
    onContinue();
  }

  return (
    <div className="school-setup-page">

      <div className="setup-header">

        <div>
          <div className="setup-eyebrow">
            PROJECT CONFIGURATION / STEP 1
          </div>

          <h1>School Setup</h1>

          <p>
            Enter your school's basic information
            and academic details.
          </p>
        </div>

        <div className={`save-indicator ${saveStatus === "Saving..." ? "saving" : ""}`}>
  <Cloud size={16} />
  {saveStatus}
        </div>

      </div>

      <div className="setup-progress">
        <div className="setup-progress-active" />
      </div>

      <div className="setup-card">

        <div className="setup-card-heading">
          <div className="setup-icon">
            <School size={22} />
          </div>

          <div>
            <h2>School Information</h2>
            <p>Basic details of your institution.</p>
          </div>
        </div>

        <div className="setup-form-grid">

          <div className="setup-field full-width">
            <label>School Name *</label>

            <input
              value={form.schoolName}
              onChange={(e) =>
                updateField("schoolName", e.target.value)
              }
              placeholder="Enter full school name"
              required
            />
          </div>

          <div className="setup-field">
            <label>School Affiliation</label>

            <select
              value={form.affiliation}
              onChange={(e) =>
                updateField("affiliation", e.target.value)
              }
            >
              <option value="KVS">
                Kendriya Vidyalaya Sangathan
              </option>
              <option value="CBSE">
                CBSE
              </option>
              <option value="State Board">
                State Board
              </option>
              <option value="ICSE">
                ICSE
              </option>
              <option value="Other">
                Other
              </option>
            </select>
          </div>

          <div className="setup-field">
            <label>School Code (Optional)</label>

            <input
              value={form.schoolCode}
              onChange={(e) =>
                updateField("schoolCode", e.target.value)
              }
              placeholder="Enter school code"
            />
          </div>

          <div className="setup-field full-width">
            <label>School Address</label>

            <textarea
              rows="3"
              value={form.address}
              onChange={(e) =>
                updateField("address", e.target.value)
              }
              placeholder="Enter school address"
            />
          </div>

          <div className="setup-field">
            <label>District</label>

            <input
              value={form.district}
              onChange={(e) =>
                updateField("district", e.target.value)
              }
              placeholder="Enter district"
            />
          </div>

          <div className="setup-field">
            <label>State</label>

            <input
              value={form.state}
              onChange={(e) =>
                updateField("state", e.target.value)
              }
              placeholder="Enter state"
            />
          </div>

          <div className="setup-field">
            <label>PIN Code</label>

            <input
              value={form.pincode}
              onChange={(e) =>
                updateField("pincode", e.target.value)
              }
              placeholder="Enter PIN code"
              maxLength="6"
            />
          </div>

        </div>

      </div>

      <div className="setup-card">

        <div className="setup-card-heading">

          <div className="setup-icon">
            <CalendarDays size={22} />
          </div>

          <div>
            <h2>Academic Year</h2>
            <p>Select the academic year for this timetable.</p>
          </div>

        </div>

        <div className="setup-field">
          <label>Academic Year *</label>

          <select
            value={form.academicYear}
            onChange={(e) =>
              updateField("academicYear", e.target.value)
            }
          >
            <option value="2026-27">2026-27</option>
            <option value="2027-28">2027-28</option>
            <option value="2028-29">2028-29</option>
            <option value="2029-30">2029-30</option>
            <option value="2030-31">2030-31</option>
          </select>
        </div>

      </div>

      <div className="setup-card">

        <div className="setup-card-heading">

          <div className="setup-icon">
            <MapPin size={22} />
          </div>

          <div>
            <h2>Working Days</h2>
            <p>Select the days on which your school operates.</p>
          </div>

        </div>

        <div className="working-days">

          {DAYS.map((day) => (

            <label
              className={`day-option ${
                form.workingDays.includes(day)
                  ? "day-selected"
                  : ""
              }`}
              key={day}
            >

              <input
                type="checkbox"
                checked={form.workingDays.includes(day)}
                onChange={() => toggleDay(day)}
              />

              <span>{day}</span>

            </label>

          ))}

        </div>

      </div>

      <div className="setup-bottom">

        <button
          className="setup-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="setup-bottom-right">

          <button
            className="setup-save-button"
            onClick={handleManualSave}
          >
            <Save size={17} />
            Save
          </button>

          <button
            className="setup-continue-button"
            onClick={handleContinue}
          >
            Continue
            <ArrowRight size={17} />
          </button>

        </div>

      </div>

    </div>
  );
}
