import { useEffect, useState } from "react";

import {
  CalendarDays,
  Clock3,
  Users,
  BookOpen,
  School,
  FileDown,
  FileUp,
  Settings,
  LayoutDashboard,
  Plus,
  Menu,
  X,
  Bell,
  ChevronRight,
  Cloud,
  FolderOpen,
  LogIn,
  GraduationCap,
  ClipboardList,
  Save,
} from "lucide-react";

import SchoolSetup from "./SchoolSetup";
import BellSchedule from "./BellSchedule";
import ClassesSections from "./ClassesSections";
import SubjectLibrary from "./SubjectLibrary";
import TeacherLibrary from "./TeacherLibrary";
import TeacherMapping from "./TeacherMapping";
import TimetableBuilder from "./TimetableBuilder";
import "../styles/dashboard.css";

// ---------------- Constants ----------------

const STORAGE_KEY = "school_timetable_projects_v1";
const SELECTED_PROJECT_KEY = "school_timetable_selected_project";
const ACTIVE_PAGE_KEY = "school_timetable_active_page";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "School Setup", icon: School },
  { label: "Bell Schedule", icon: Clock3 },
  { label: "Classes & Sections", icon: GraduationCap },
  { label: "Subjects", icon: BookOpen },
  { label: "Teachers", icon: Users },
  { label: "Teacher Mapping", icon: ClipboardList },
  { label: "Timetable Builder", icon: CalendarDays },
  { label: "Reports & Export", icon: FileDown },
];

const steps = [
  "School Setup",
  "Bell Schedule",
  "Classes & Sections",
  "Subjects",
  "Teachers",
  "Teacher Mapping",
  "Teacher Period Allocation",
  "Timetable Builder",
];

// Pages that are fully implemented (no "coming soon" notice).
const IMPLEMENTED_PAGES = new Set([
  "School Setup",
  "Bell Schedule",
  "Classes & Sections",
  "Subjects",
  "Teachers",
  "Teacher Mapping",
  "Timetable Builder",
]);

// Pages that render their own content and must hide the dashboard body.
const BUILDER_PAGES = new Set([
  "School Setup",
  "Bell Schedule",
  "Classes & Sections",
  "Subjects",
  "Teachers",
  "Teacher Mapping",
  "Timetable Builder",
]);

// Pages that require a selected project.
const PROJECT_PAGES = BUILDER_PAGES;

// ---------------- Helpers ----------------

function readProjects() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read projects:", error);
    return [];
  }
}

// ---------------- Component ----------------

export default function Dashboard() {
  const [projects, setProjects] = useState(readProjects);

  const [showModal, setShowModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem(ACTIVE_PAGE_KEY) || "Dashboard";
  });

  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved");

  const [schoolName, setSchoolName] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-27");

  // Auto-select the saved project, or fall back to the most recent one.
  const [selectedProject, setSelectedProject] = useState(() => {
    const savedId = localStorage.getItem(SELECTED_PROJECT_KEY);
    const found = projects.find((project) => project.id === savedId);
    if (found) return found;
    return projects.length ? projects[0] : null;
  });

  // ---------------- Persistence effects ----------------

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      setSaveStatus("saved");
    } catch (error) {
      console.error("Unable to save projects:", error);
      setSaveStatus("error");
      setNotice("Unable to save. Browser storage may be full.");
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProject?.id) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProject.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_PAGE_KEY, activePage);
  }, [activePage]);

  // Reset to Dashboard if the active page needs a project but none is selected.
  useEffect(() => {
    if (!selectedProject && PROJECT_PAGES.has(activePage)) {
      setActivePage("Dashboard");
    }
  }, [selectedProject, activePage]);

  // ---------------- Actions ----------------

  function handleNavigation(label) {
    setActivePage(label);
    setMobileMenu(false);

    if (label === "Dashboard" || IMPLEMENTED_PAGES.has(label)) {
      setNotice("");
    } else {
      setNotice(`${label} will be implemented in upcoming development stages.`);
    }
  }

  function createProject(event) {
    event.preventDefault();

    if (!schoolName.trim()) {
      setNotice("Please enter a school name.");
      return;
    }

    const project = {
      id: crypto.randomUUID(),
      schoolName: schoolName.trim(),
      academicYear,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: 0,
      status: "Draft",
      data: {
        school: {},
        bellSchedule: {},
        classes: [],
        subjects: [],
        teachers: [],
        mappings: [],
        teacherMappings: [],
        allocations: [],
        timetable: [],
        substitutions: [],
      },
    };

    setProjects((previous) => [project, ...previous]);
    setSelectedProject(project);
    setSchoolName("");
    setAcademicYear("2026-27");
    setShowModal(false);
    setActivePage("School Setup");
    setNotice("New school project created successfully.");
  }

  function openProject(project) {
    setSelectedProject(project);
    setActivePage("School Setup");
    setNotice(`Opened ${project.schoolName}.`);
  }

  function updateProjectData(dataKey, newData, extraUpdates = {}) {
    if (!selectedProject?.id) return;

    const projectId = selectedProject.id;

    setProjects((previous) =>
      previous.map((project) =>
        project.id === projectId
          ? {
              ...project,
              ...extraUpdates,
              updatedAt: new Date().toISOString(),
              data: {
                ...project.data,
                [dataKey]: newData,
              },
            }
          : project
      )
    );

    setSelectedProject((previous) =>
      previous?.id === projectId
        ? {
            ...previous,
            ...extraUpdates,
            updatedAt: new Date().toISOString(),
            data: {
              ...previous.data,
              [dataKey]: newData,
            },
          }
        : previous
    );
  }

  function updateProjectSchool(schoolData) {
    updateProjectData("school", schoolData, {
      schoolName: schoolData.schoolName,
      academicYear: schoolData.academicYear,
    });
  }

  function updateProjectBellSchedule(bellScheduleData) {
    updateProjectData("bellSchedule", bellScheduleData);
  }

  function updateProjectClasses(classesData) {
    updateProjectData("classes", classesData);
  }

  function updateProjectSubjects(subjectsData) {
    updateProjectData("subjects", subjectsData);
  }

  function updateProjectMappings(mappingsData) {
    updateProjectData("mappings", mappingsData);
  }

  function updateProjectTeacherMappings(teacherMappingsData) {
    updateProjectData("teacherMappings", teacherMappingsData);
  }

  function updateProjectTeachers(teachersData) {
    updateProjectData("teachers", teachersData);
  }

  function updateProjectTimetable(timetableData) {
    updateProjectData("timetable", timetableData);
  }

  function updateProjectSubstitutions(substitutionData) {
    updateProjectData("substitutions", substitutionData);
  }

  function updateProjectTimetableSettings(settingsData) {
    updateProjectData("timetableSettings", settingsData);
  }

  function downloadProject(project) {
    try {
      const fileData = {
        format: "school-timetable-project",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        project,
      };

      const blob = new Blob([JSON.stringify(fileData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${project.schoolName.replace(
        /[^a-z0-9]/gi,
        "_"
      )}_${project.academicYear}.timetable`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setNotice("Project backup downloaded successfully.");
    } catch (error) {
      console.error(error);
      setNotice("Unable to download project.");
    }
  }

  function uploadProject(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);

        if (
          imported.format !== "school-timetable-project" ||
          imported.schemaVersion !== 1 ||
          !imported.project?.schoolName ||
          !imported.project?.data
        ) {
          throw new Error("Invalid project file.");
        }

        const restored = {
          ...imported.project,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
          status: "Draft",
        };

        const confirmed = window.confirm(
          `Import project "${restored.schoolName}" for ${restored.academicYear}?`
        );

        if (!confirmed) return;

        setProjects((previous) => [restored, ...previous]);
        setSelectedProject(restored);
        setActivePage("School Setup");
        setNotice("Project imported successfully.");
      } catch (error) {
        console.error(error);
        setNotice("Invalid or unsupported timetable project file.");
      } finally {
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      setNotice("Unable to read the selected file.");
      event.target.value = "";
    };

    reader.readAsText(file);
  }

  // ---------------- Derived setup progress ----------------

  const projectData = selectedProject?.data || {};

  const schoolData = projectData.school || {};
  const bellData = projectData.bellSchedule || {};

  const schoolClasses = Array.isArray(projectData.classes)
    ? projectData.classes
    : [];
  const schoolSubjects = Array.isArray(projectData.subjects)
    ? projectData.subjects
    : [];
  const subjectMappings = Array.isArray(projectData.mappings)
    ? projectData.mappings
    : [];
  const schoolTeachers = Array.isArray(projectData.teachers)
    ? projectData.teachers
    : [];
  const teacherMappings = Array.isArray(projectData.teacherMappings)
    ? projectData.teacherMappings
    : [];

  const activeClasses = schoolClasses.filter((item) => item.active !== false);
  const activeSubjects = schoolSubjects.filter((item) => item.active !== false);
  const activeTeachers = schoolTeachers.filter((item) => item.active !== false);

  const schoolSetupComplete =
    Boolean(schoolData.schoolName?.trim()) &&
    Boolean(schoolData.academicYear) &&
    Array.isArray(schoolData.workingDays) &&
    schoolData.workingDays.length > 0;

  const bellScheduleComplete =
    Array.isArray(bellData.schedule) &&
    bellData.schedule.filter((item) => item.type === "period").length ===
      Number(bellData.periodCount) &&
    Number(bellData.periodCount) > 0;

  const classesComplete = activeClasses.some(
    (item) =>
      Array.isArray(item.sections) &&
      item.sections.some((section) => section.active !== false)
  );

  const subjectsComplete =
    activeSubjects.length > 0 &&
    subjectMappings.some(
      (mapping) =>
        activeClasses.some((item) => item.id === mapping.classId) &&
        activeSubjects.some((item) => item.id === mapping.subjectId) &&
        Number(mapping.periodsPerWeek) > 0
    );

  const teachersComplete = activeTeachers.length > 0;

  const teacherMappingComplete = teacherMappings.some(
    (mapping) =>
      activeTeachers.some((item) => item.id === mapping.teacherId) &&
      activeClasses.some((item) => item.id === mapping.classId) &&
      activeSubjects.some((item) => item.id === mapping.subjectId)
  );

  const completedStages = [
    schoolSetupComplete,
    bellScheduleComplete,
    classesComplete,
    subjectsComplete,
    teachersComplete,
    teacherMappingComplete,
    false,
    false,
  ];

  const completedCount = completedStages.filter(Boolean).length;
  const progressPercentage = Math.round(
    (completedCount / steps.length) * 100
  );

  // ---------------- Render ----------------

  const isBuilderPage = BUILDER_PAGES.has(activePage);

  return (
    <div className="app-shell">
      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <School size={25} />
          </div>

          <div>
            <h2>
              School<span>TT</span>
            </h2>
            <p>Timetable Maker</p>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => handleNavigation(item.label)}
              >
                <Icon size={18} />
                <span>{item.label}</span>

                {item.label === "Timetable Builder" && (
                  <span className="nav-new">Core</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="guest-card">
            <div className="guest-heading">
              <Cloud size={17} />
              <span>Guest Mode</span>
            </div>

            <p>
              Your projects are saved in this browser. Download backups
              regularly.
            </p>

            <button
              onClick={() =>
                setNotice(
                  "Account registration will be added in the authentication stage."
                )
              }
            >
              <LogIn size={15} />
              Create Account
            </button>
          </div>

          <button
            className="nav-item settings-item"
            onClick={() =>
              setNotice("Application settings will be added later.")
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <div className="sidebar-footer">Version 0.1.0 · Development</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            Workspace
            <ChevronRight size={15} />
            {activePage}
          </div>

          <div className="topbar-right">
            <span className="save-status">
              {saveStatus === "saved" ? "✓ Saved locally" : "⚠ Save error"}
            </span>

            <span className="guest-badge">
              <span className="status-dot" />
              Guest Mode
            </span>

            <button
              className="icon-button"
              title="Notifications"
              onClick={() => setNotice("No new notifications.")}
            >
              <Bell size={19} />
            </button>
          </div>
        </header>

        {/* SCHOOL SETUP PAGE */}
        {activePage === "School Setup" &&
          (selectedProject ? (
            <SchoolSetup
              key={selectedProject.id}
              project={selectedProject}
              onUpdate={updateProjectSchool}
              onContinue={() => {
                setActivePage("Bell Schedule");
                setNotice("");
              }}
              onBack={() => {
                setActivePage("Dashboard");
                setSelectedProject(null);
                setNotice("");
              }}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-icon">
                  <School size={30} />
                </div>
                <h3>No School Project Selected</h3>
                <p>
                  Please create a new school project or open an existing
                  project.
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setActivePage("Dashboard");
                    setShowModal(true);
                  }}
                >
                  <Plus size={17} />
                  Create New Project
                </button>
              </div>
            </div>
          ))}

        {/* BELL SCHEDULE PAGE */}
        {activePage === "Bell Schedule" &&
          (selectedProject ? (
            <BellSchedule
              key={selectedProject.id}
              project={selectedProject}
              onSave={updateProjectBellSchedule}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-icon">
                  <Clock3 size={30} />
                </div>
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* CLASSES & SECTIONS PAGE */}
        {activePage === "Classes & Sections" &&
          (selectedProject ? (
            <ClassesSections
              key={selectedProject.id}
              project={selectedProject}
              onSave={updateProjectClasses}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-icon">
                  <GraduationCap size={30} />
                </div>
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* SUBJECTS PAGE */}
        {activePage === "Subjects" &&
          (selectedProject ? (
            <SubjectLibrary
              key={selectedProject.id}
              project={selectedProject}
              onSave={updateProjectSubjects}
              onSaveMappings={updateProjectMappings}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-icon">
                  <BookOpen size={30} />
                </div>
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* TEACHERS PAGE */}
        {activePage === "Teachers" &&
          (selectedProject ? (
            <TeacherLibrary
              key={selectedProject.id}
              project={selectedProject}
              onSave={updateProjectTeachers}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-icon">
                  <BookOpen size={30} />
                </div>
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* TEACHER MAPPING PAGE */}
        {activePage === "Teacher Mapping" &&
          (selectedProject ? (
            <TeacherMapping
              key={selectedProject.id}
              project={selectedProject}
              onSave={updateProjectTeacherMappings}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* TIMETABLE BUILDER PAGE */}
        {activePage === "Timetable Builder" &&
          (selectedProject ? (
            <TimetableBuilder
              key={selectedProject.id}
              project={selectedProject}
              onSaveTimetable={updateProjectTimetable}
              onSaveSubstitutions={updateProjectSubstitutions}
              onSaveTimetableSettings={updateProjectTimetableSettings}
            />
          ) : (
            <div className="content">
              <div className="empty-state">
                <h3>No School Project Selected</h3>
                <p>Please create or open a school project first.</p>
                <button
                  className="primary-button"
                  onClick={() => setActivePage("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ))}

        {/* DASHBOARD BODY (hidden when any builder page is open) */}
        <div className={`content ${isBuilderPage ? "content-hidden" : ""}`}>
          {/* WELCOME */}
          <div className="welcome-section">
            <div>
              <div className="eyebrow">SCHOOL MANAGEMENT WORKSPACE</div>

              <h1>Welcome to your dashboard</h1>

              <p>
                Create, organise and manage your school's complete timetable
                in one place.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowModal(true)}
            >
              <Plus size={19} />
              Create New Project
            </button>
          </div>

          {/* NOTIFICATION */}
          {notice && (
            <div className="notice">
              <span>{notice}</span>

              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* STATISTICS */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple">
                <FolderOpen size={21} />
              </div>
              <div>
                <p>Total Projects</p>
                <h2>{projects.length}</h2>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <School size={21} />
              </div>
              <div>
                <p>School Projects</p>
                <h2>{projects.length}</h2>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                <Save size={21} />
              </div>
              <div>
                <p>Saved Projects</p>
                <h2>{projects.length}</h2>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                <CalendarDays size={21} />
              </div>
              <div>
                <p>Published Timetables</p>
                <h2>0</h2>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Quick Actions</h2>
                <p>Start working on your timetable.</p>
              </div>
            </div>

            <div className="action-grid">
              <button
                className="action-card"
                onClick={() => setShowModal(true)}
              >
                <div className="action-icon purple">
                  <Plus size={23} />
                </div>
                <h3>New Project</h3>
                <p>Create a timetable for a school.</p>
                <ChevronRight size={18} className="action-arrow" />
              </button>

              <button
                className="action-card"
                onClick={() =>
                  document.getElementById("project-upload")?.click()
                }
              >
                <div className="action-icon blue">
                  <FileUp size={23} />
                </div>
                <h3>Upload Project</h3>
                <p>Restore a previously downloaded project.</p>
                <ChevronRight size={18} className="action-arrow" />
              </button>

              <button
                className="action-card"
                onClick={() =>
                  setNotice(
                    "PDF and Excel export will be developed after the timetable builder."
                  )
                }
              >
                <div className="action-icon green">
                  <FileDown size={23} />
                </div>
                <h3>Export Timetable</h3>
                <p>Download PDF and Excel timetables.</p>
                <ChevronRight size={18} className="action-arrow" />
              </button>

              <button
                className="action-card"
                onClick={() =>
                  setNotice(
                    "Login and cloud saving will be implemented later."
                  )
                }
              >
                <div className="action-icon orange">
                  <Cloud size={23} />
                </div>
                <h3>Cloud Storage</h3>
                <p>Save your work online with an account.</p>
                <ChevronRight size={18} className="action-arrow" />
              </button>
            </div>

            <input
              id="project-upload"
              type="file"
              accept=".timetable,.json,application/json"
              hidden
              onChange={uploadProject}
            />
          </section>

          {/* RECENT PROJECTS */}
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Recent Projects</h2>
                <p>Continue working on your saved school projects.</p>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <FolderOpen size={30} />
                </div>
                <h3>No projects yet</h3>
                <p>
                  Create your first school timetable project to get started.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setShowModal(true)}
                >
                  <Plus size={17} />
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="project-list">
                {projects.map((project) => (
                  <div className="project-card" key={project.id}>
                    <div className="project-school-icon">
                      <School size={23} />
                    </div>

                    <div className="project-info">
                      <h3>{project.schoolName}</h3>
                      <p>Academic Year: {project.academicYear}</p>
                      <span>
                        Last saved:{" "}
                        {new Date(project.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    <span className="draft-badge">{project.status}</span>

                    <button
                      className="secondary-button"
                      onClick={() => openProject(project)}
                    >
                      Open Project
                      <ChevronRight size={16} />
                    </button>

                    <button
                      className="icon-button"
                      title="Download project backup"
                      onClick={() => downloadProject(project)}
                    >
                      <FileDown size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SETUP PROGRESS */}
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Timetable Creation Progress</h2>
                <p>Your school setup will follow these steps.</p>
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-header">
                <span>Setup checklist</span>
                <span>
                  {completedCount} / {steps.length} completed
                </span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <div className="steps-list">
                {steps.map((step, index) => (
                  <div className="step-item" key={step}>
                    <span className="step-number">{index + 1}</span>
                    <span>{step}</span>
                    <span className="step-status">
                      {completedStages[index] ? "Completed" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SELECTED PROJECT */}
          {selectedProject && (
            <section className="section selected-project">
              <h2>Selected project</h2>
              <p>
                {selectedProject.schoolName}
                {" · "}
                {selectedProject.academicYear}
              </p>
              <p>
                Continue configuring your school, bell schedule, classes,
                subjects and teacher assignments.
              </p>
            </section>
          )}

          <footer className="footer">
            School Timetable Maker · Built for flexible school scheduling
          </footer>
        </div>
      </main>

      {/* CREATE PROJECT MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Create New Project</h2>
                <p>Enter your school's basic details.</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createProject}>
              <label htmlFor="school-name">School Name</label>

              <input
                id="school-name"
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="Enter school name"
                required
                autoFocus
              />

              <label htmlFor="academic-year">Academic Year</label>

              <select
                id="academic-year"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              >
                <option value="2026-27">2026-27</option>
                <option value="2027-28">2027-28</option>
                <option value="2028-29">2028-29</option>
                <option value="2029-30">2029-30</option>
              </select>

              <div className="modal-note">
                <Cloud size={17} />
                Guest project: your work will initially be saved in this
                browser.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  <Plus size={17} />
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}