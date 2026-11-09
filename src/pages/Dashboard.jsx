import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
  Trash2,
} from "lucide-react";

import SchoolSetup from "./SchoolSetup";
import BellSchedule from "./BellSchedule";
import ClassesSections from "./ClassesSections";
import SubjectLibrary from "./SubjectLibrary";
import TeacherLibrary from "./TeacherLibrary";
import TeacherMapping from "./TeacherMapping";
import TimetableBuilder from "./TimetableBuilder";
import "../styles/dashboard.css";

// ---------------- Helpers ----------------

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Every project is guaranteed to have this shape. */
const DEFAULT_DATA = () => ({
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
  timetableSettings: {},
});

function normalizeProject(project) {
  if (!project || typeof project !== "object") return null;
  if (!project.id || typeof project.id !== "string") return null;

  return {
    ...project,
    schoolName: String(project.schoolName || "").trim(),
    academicYear: String(project.academicYear || "2026-27"),
    status: project.status || "Draft",
    updatedAt: project.updatedAt || new Date().toISOString(),
    createdAt: project.createdAt || new Date().toISOString(),
    data: { ...DEFAULT_DATA(), ...(project.data || {}) },
  };
}

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

const IMPLEMENTED_PAGES = new Set([
  "School Setup",
  "Bell Schedule",
  "Classes & Sections",
  "Subjects",
  "Teachers",
  "Teacher Mapping",
  "Timetable Builder",
]);

const BUILDER_PAGES = IMPLEMENTED_PAGES;
const PROJECT_PAGES = IMPLEMENTED_PAGES;

// ---------------- Storage ----------------

function readProjects() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProject).filter(Boolean);
  } catch (error) {
    console.error("Unable to read projects:", error);
    return [];
  }
}

// ---------------- Component ----------------

export default function Dashboard({ session }) {
  const [projects, setProjects] = useState(readProjects);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [activePage, setActivePage] = useState("Dashboard");

  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved");

  const [schoolName, setSchoolName] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-27");

  // ---------------- Selected project (derived) ----------------
  //
  // We store only the selected id and derive the project from `projects`.
  // This removes an entire class of "selectedProject drifted from projects"
  // bugs — any update to `projects` immediately propagates to `selectedProject`.

  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try {
      const savedId = window.localStorage?.getItem(SELECTED_PROJECT_KEY);
      if (savedId && projects.some((p) => p.id === savedId)) return savedId;
    } catch (error) {
      console.error("Unable to read selected project:", error);
    }
    return projects.length ? projects[0].id : null;
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // ---------------- Persistence effects ----------------

  // Guest projects stay in this browser. Account projects are stored in Supabase.
  useEffect(() => {
    if (session?.user?.id) return;
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      setSaveStatus("saved");
    } catch (error) {
      console.error("Unable to save guest projects:", error);
      setSaveStatus("error");
      setNotice("Unable to save locally. Browser storage may be full. Download a backup.");
    }
  }, [projects, session?.user?.id]);

  // Load this account's projects. If the account's cloud table is empty,
  // transfer this browser's saved projects to the account as a first-time migration.
  useEffect(() => {
    let cancelled = false;

    async function loadAccountProjects() {
      const userId = session?.user?.id;
      if (!userId) {
        setCloudLoaded(true);
        setSaveStatus("saved");
        return;
      }

      setCloudLoaded(false);
      setSaveStatus("saving");
      const { data: rows, error } = await supabase
        .from("timetables")
        .select("id, user_id, title, timetable_data, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Unable to load cloud projects:", error.message);
        setSaveStatus("error");
        setNotice(`Could not load cloud projects: ${error.message}`);
        setCloudLoaded(true);
        return;
      }

      let accountRows = rows || [];
      if (accountRows.length === 0) {
        const localProjects = readProjects();
        if (localProjects.length > 0) {
          const payload = localProjects.map((project) => ({
            id: project.id,
            user_id: userId,
            title: project.schoolName || "Untitled school",
            timetable_data: project,
            created_at: project.createdAt,
            updated_at: project.updatedAt,
          }));
          const { data: migratedRows, error: migrationError } = await supabase
            .from("timetables")
            .upsert(payload, { onConflict: "id" })
            .select("id, user_id, title, timetable_data, created_at, updated_at");

          if (cancelled) return;
          if (migrationError) {
            console.error("Local project migration failed:", migrationError.message);
            setNotice(`Cloud migration failed: ${migrationError.message}. Your browser copies remain saved.`);
            setSaveStatus("error");
            setCloudLoaded(true);
            return;
          }
          accountRows = migratedRows || payload;
          setNotice(`Transferred ${localProjects.length} browser project(s) to your account.`);
        }
      }

      const cloudProjects = accountRows
        .map((row) => normalizeProject({
          ...(row.timetable_data || {}),
          id: row.id,
          schoolName: row.timetable_data?.schoolName || row.title,
          createdAt: row.created_at || row.timetable_data?.createdAt,
          updatedAt: row.updated_at || row.timetable_data?.updatedAt,
        }))
        .filter(Boolean);

      setProjects(cloudProjects);
      const savedId = window.localStorage?.getItem(SELECTED_PROJECT_KEY);
      setSelectedProjectId(
        cloudProjects.some((project) => project.id === savedId)
          ? savedId
          : cloudProjects[0]?.id || null
      );
      setSaveStatus("saved");
      setCloudLoaded(true);
    }

    loadAccountProjects();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // Debounced upsert of the account's project list. Wait until initial cloud
  // loading is complete so the initial browser state cannot overwrite cloud data.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !cloudLoaded) return;

    setSaveStatus("saving");
    const timer = window.setTimeout(async () => {
      const payload = projects.map((project) => ({
        id: project.id,
        user_id: userId,
        title: project.schoolName || "Untitled school",
        timetable_data: project,
        created_at: project.createdAt,
        updated_at: project.updatedAt || new Date().toISOString(),
      }));

      if (payload.length === 0) {
        setSaveStatus("saved");
        return;
      }

      const { error } = await supabase
        .from("timetables")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        console.error("Cloud save failed:", error.message);
        setSaveStatus("error");
        setNotice(`Cloud save failed: ${error.message}`);
      } else {
        setSaveStatus("saved");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [projects, session?.user?.id, cloudLoaded]);

  useEffect(() => {
    if (selectedProjectId) {
      try {
        window.localStorage?.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
      } catch (error) {
        console.error("Unable to save selected project:", error);
      }
    } else {
      window.localStorage?.removeItem(SELECTED_PROJECT_KEY);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(ACTIVE_PAGE_KEY, activePage);
    } catch (error) {
      console.error("Unable to save active page:", error);
    }
  }, [activePage]);

  // Guard: if the selected project disappeared, clear the id so the empty
  // state shows instead of a stale reference.
  useEffect(() => {
    if (selectedProjectId && !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects.length ? projects[0].id : null);
    }
  }, [projects, selectedProjectId]);

  // Reset to Dashboard if the active page needs a project but none is selected.
  useEffect(() => {
    if (!selectedProject && PROJECT_PAGES.has(activePage)) {
      setActivePage("Dashboard");
    }
  }, [selectedProject, activePage]);

  // ---------------- Navigation ----------------

  function handleNavigation(label) {
    setActivePage(label);
    setMobileMenu(false);

    if (label === "Dashboard" || IMPLEMENTED_PAGES.has(label)) {
      setNotice("");
    } else {
      setNotice(`${label} will be implemented in upcoming development stages.`);
    }
  }

  // ---------------- Project CRUD ----------------

  function createProject(event) {
    event.preventDefault();

    const name = schoolName.trim();
    if (!name) {
      setNotice("Please enter a school name.");
      return;
    }

    const project = normalizeProject({
      id: createId(),
      schoolName: name,
      academicYear,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: 0,
      status: "Draft",
      data: DEFAULT_DATA(),
    });

    setProjects((previous) => [project, ...previous]);
    setSelectedProjectId(project.id);
    setSchoolName("");
    setAcademicYear("2026-27");
    setShowModal(false);
    setActivePage("School Setup");
    setNotice("New school project created successfully.");
  }

  function openProject(project) {
    if (!project?.id) return;
    setSelectedProjectId(project.id);
    setActivePage("School Setup");
    setNotice(`Opened ${project.schoolName || "project"}.`);
  }

  function deleteProject(project) {
    if (!project?.id) return;

    const confirmed = window.confirm(
      `Delete "${project.schoolName || "this project"}"? This cannot be undone.`
    );
    if (!confirmed) return;

    // Flush safety: any in-flight save from a child for this project is
    // harmless — the child unmounts and its pending record flushes; then
    // the filter below drops the project. Subsequent calls find nothing.
    setProjects((previous) => previous.filter((p) => p.id !== project.id));

    if (session?.user?.id) {
      supabase
        .from("timetables")
        .delete()
        .eq("id", project.id)
        .eq("user_id", session.user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Cloud project deletion failed:", error.message);
            setNotice(`Cloud delete failed: ${error.message}`);
          }
        });
    }

    if (selectedProjectId === project.id) {
      const remaining = projects.filter((p) => p.id !== project.id);
      setSelectedProjectId(remaining.length ? remaining[0].id : null);
      setActivePage("Dashboard");
    }

    setNotice(`Deleted "${project.schoolName || "project"}".`);
  }

  // ---------------- Project data updates ----------------
  //
  // Only one writer: `projects`. `selectedProject` derives automatically.
  // The closure captures the CURRENT `selectedProject.id` so that a pending
  // debounced save flushed from an unmounting child still writes to the
  // project it belongs to.

  function updateProjectData(dataKey, newData, extraUpdates = {}) {
    const projectId = selectedProject?.id;
    if (!projectId || typeof dataKey !== "string" || !dataKey.trim()) return;

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
  }

  function updateProjectSchool(schoolData) {
    const safe = schoolData && typeof schoolData === "object" ? schoolData : {};

    // Only overwrite top-level `schoolName` / `academicYear` when the
    // incoming values are actually usable. Otherwise keep the previous ones.
    const extras = {};
    if (typeof safe.schoolName === "string" && safe.schoolName.trim()) {
      extras.schoolName = safe.schoolName.trim();
    }
    if (typeof safe.academicYear === "string" && safe.academicYear) {
      extras.academicYear = safe.academicYear;
    }

    updateProjectData("school", safe, extras);
  }

  function updateProjectBellSchedule(data) {
    updateProjectData("bellSchedule", data);
  }
  function updateProjectClasses(data) {
    updateProjectData("classes", data);
  }
  function updateProjectSubjects(data) {
    updateProjectData("subjects", data);
  }
  function updateProjectMappings(data) {
    updateProjectData("mappings", data);
  }
  function updateProjectTeacherMappings(data) {
    updateProjectData("teacherMappings", data);
  }
  function updateProjectTeachers(data) {
    updateProjectData("teachers", data);
  }
  function updateProjectTimetable(data) {
    updateProjectData("timetable", data);
  }
  function updateProjectSubstitutions(data) {
    updateProjectData("substitutions", data);
  }
  function updateProjectTimetableSettings(data) {
    updateProjectData("timetableSettings", data);
  }

  // ---------------- Import / export ----------------

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

      const safeName = String(project?.schoolName || "project").replace(
        /[^a-z0-9]/gi,
        "_"
      );
      const safeYear = String(project?.academicYear || "year").replace(
        /[^a-z0-9]/gi,
        "_"
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}_${safeYear}.timetable`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

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
          !imported ||
          imported.format !== "school-timetable-project" ||
          imported.schemaVersion !== 1 ||
          !imported.project ||
          typeof imported.project !== "object" ||
          !imported.project.schoolName ||
          typeof imported.project.schoolName !== "string" ||
          !imported.project.data ||
          typeof imported.project.data !== "object"
        ) {
          throw new Error("Invalid project file.");
        }

        const restored = normalizeProject({
          ...imported.project,
          id: createId(),
          createdAt: imported.project.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "Draft",
        });

        if (!restored) throw new Error("Invalid project file.");

        const confirmed = window.confirm(
          `Import project "${restored.schoolName}" for ${restored.academicYear}?`
        );
        if (!confirmed) return;

        setProjects((previous) => [restored, ...previous]);
        setSelectedProjectId(restored.id);
        setActivePage("School Setup");
        setNotice("Project imported successfully.");
      } catch (error) {
        console.error(error);
        setNotice("Invalid or unsupported timetable project file.");
      } finally {
        if (event?.target) event.target.value = "";
      }
    };

    reader.onerror = () => {
      setNotice("Unable to read the selected file.");
      if (event?.target) event.target.value = "";
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
    Boolean(String(schoolData.schoolName || "").trim()) &&
    Boolean(schoolData.academicYear) &&
    Array.isArray(schoolData.workingDays) &&
    schoolData.workingDays.length > 0;

  const bellScheduleComplete =
    Array.isArray(bellData.schedule) &&
    Number(bellData.periodCount) > 0 &&
    bellData.schedule.filter((item) => item.type === "period").length ===
      Number(bellData.periodCount);

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
    Array.isArray(projectData.allocations) && projectData.allocations.length > 0,
    Array.isArray(projectData.timetable) && projectData.timetable.length > 0,
  ];

  const completedCount = completedStages.filter(Boolean).length;
  const progressPercentage = Math.round(
    (completedCount / steps.length) * 100
  );

  const draftCount = projects.filter((p) => p.status === "Draft").length;
  const publishedCount = projects.filter((p) => p.status === "Published").length;

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
              <span>{session?.user?.id ? "Cloud Storage" : "Guest Mode"}</span>
            </div>

            <p>
              {session?.user?.id
                ? "Your projects are saved to your Supabase account and can be accessed after signing in."
                : "Your projects are saved in this browser. Download backups regularly."}
            </p>

            {!session?.user?.id && (
              <button onClick={() => setNotice("Please use the Sign In / Sign Up page to create an account.")}>
                <LogIn size={15} />
                Create Account
              </button>
            )}
          </div>

          <button
            className="nav-item settings-item"
            onClick={() => setNotice("Application settings will be added later.")}
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
              {saveStatus === "saved" ? (session?.user?.id ? "✓ Saved to cloud" : "✓ Saved locally") : saveStatus === "saving" ? "Saving…" : "⚠ Save error"}
            </span>

            <span className="guest-badge">
              <span className="status-dot" />
              {session?.user?.id ? "Account Mode" : "Guest Mode"}
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
                // Keep the project selected — user is just navigating back.
                setActivePage("Dashboard");
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
  onContinue={() => setActivePage("Classes & Sections")}
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
  onContinue={() => setActivePage("Subjects")}
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
                  <Users size={30} />
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

        {/* DASHBOARD BODY */}
        <div className={`content ${isBuilderPage ? "content-hidden" : ""}`}>
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
                <p>Draft Projects</p>
                <h2>{draftCount}</h2>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                <Save size={21} />
              </div>
              <div>
                <p>Current Selection</p>
                <h2>{selectedProject ? "1" : "0"}</h2>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                <CalendarDays size={21} />
              </div>
              <div>
                <p>Published Timetables</p>
                <h2>{publishedCount}</h2>
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
                  setNotice("Login and cloud saving will be implemented later.")
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
                  <div
                    className={`project-card ${
                      project.id === selectedProjectId
                        ? "project-card-selected"
                        : ""
                    }`}
                    key={project.id}
                  >
                    <div className="project-school-icon">
                      <School size={23} />
                    </div>

                    <div className="project-info">
                      <h3>{project.schoolName || "Untitled"}</h3>
                      <p>Academic Year: {project.academicYear}</p>
                      <span>
                        Last saved:{" "}
                        {Number.isNaN(new Date(project.updatedAt).getTime()) ? "Unknown" : new Date(project.updatedAt).toLocaleString()}
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

                    <button
                      className="icon-button icon-button-danger"
                      title="Delete project"
                      onClick={() => deleteProject(project)}
                    >
                      <Trash2 size={18} />
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
                {selectedProject.schoolName || "Untitled"}
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
          <div className="modal" onClick={(event) => event.stopPropagation()}>
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
                <option value="2030-31">2030-31</option>
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