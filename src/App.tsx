import { useEffect, useMemo, useState } from "react";
import SimpleToggleLayout from "./components/Layout/SimpleToggleLayout";
import type { Panel } from "./components/Layout/SimpleToggleLayout";
import CSVUpload from "./components/CSVUpload";
import StudentsPane from "./components/StudentsPane";
import ProjectsPane from "./components/ProjectsPane";
import AnalysisPane from "./components/AnalysisPane";
import { Download, Settings } from "lucide-react";
import { autoAssign, type AutoFillMode } from "./utils/autoAssign";
import { buildRoundTripExport } from "./utils/exportXlsx";
import "./components/Layout/MainApp.css";
import "./components/AnalysisPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
};

const STORAGE_KEY = "group-maker:v1";

type PersistedState = {
  students: Student[];
  projects: string[];
  projectAssignments: Record<string, string[]>;
  maxProjectSize: number;
  autoFillMode: AutoFillMode;
  studentsSearchQuery: string;
  projectsSearchQuery: string;
};

function safeParsePersistedState(raw: string | null): PersistedState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PersistedState>;
    if (!data || typeof data !== "object") return null;
    if (!Array.isArray(data.students) || !Array.isArray(data.projects)) return null;
    if (!data.projectAssignments || typeof data.projectAssignments !== "object") return null;
    if (typeof data.maxProjectSize !== "number") return null;
    if (typeof data.autoFillMode !== "string") return null;
    if (typeof data.studentsSearchQuery !== "string") return null;
    if (typeof data.projectsSearchQuery !== "string") return null;
    return data as PersistedState;
  } catch {
    return null;
  }
}

function normalizeAssignments(
  projects: string[],
  projectAssignments: Record<string, string[]>
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  const studentIdsSeen = new Set<string>();

  // Ensure every project has an array and remove duplicates across projects.
  for (const project of projects) {
    const ids = Array.isArray(projectAssignments[project]) ? projectAssignments[project] : [];
    const filtered: string[] = [];
    for (const id of ids) {
      if (typeof id !== "string") continue;
      if (studentIdsSeen.has(id)) continue;
      studentIdsSeen.add(id);
      filtered.push(id);
    }
    next[project] = filtered;
  }
  return next;
}

export default function MainApp() {
  const loaded = safeParsePersistedState(localStorage.getItem(STORAGE_KEY));

  const [students, setStudents] = useState<Student[]>(loaded?.students ?? []);
  const [projects, setProjects] = useState<string[]>(loaded?.projects ?? []);
  // Track assignments: project name -> array of student IDs
  const [projectAssignments, setProjectAssignments] = useState<Record<string, string[]>>(
    loaded?.projects && loaded?.projectAssignments
      ? normalizeAssignments(loaded.projects, loaded.projectAssignments)
      : {}
  );
  const [maxProjectSize, setMaxProjectSize] = useState(
    Number.isFinite(loaded?.maxProjectSize) ? Math.max(1, loaded!.maxProjectSize) : 6
  );
  const [autoFillMode, setAutoFillMode] = useState<AutoFillMode>(
    (loaded?.autoFillMode as AutoFillMode) ?? "firstChoiceOnly"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleCSVUpload = (data: {
    students: Student[];
    projects: string[];
    projectAssignments?: Record<string, string[]>;
  }) => {
    setStudents(data.students);
    setProjects(data.projects);
    if (data.projectAssignments) {
      // If input includes Assigned Project, trust it as the starting state.
      setProjectAssignments(data.projectAssignments);
      return;
    }

    setProjectAssignments(
      autoAssign({
        mode: autoFillMode,
        students: data.students,
        projects: data.projects,
        capacity: Math.max(1, maxProjectSize),
        seed: 1,
      })
    );
  };

  const assignedStudentIds = useMemo(() => {
    const assigned = new Set<string>();
    Object.values(projectAssignments).forEach((studentIds) => {
      studentIds.forEach((id) => assigned.add(id));
    });
    return assigned;
  }, [projectAssignments]);

  const handleStudentDrop = (studentId: string, projectName: string) => {
    setProjectAssignments((prev) => {
      const newAssignments = { ...prev };
      
      // Remove student from any existing project
      Object.keys(newAssignments).forEach((project) => {
        newAssignments[project] = newAssignments[project].filter((id) => id !== studentId);
      });

      // Add to new project (only if not over capacity)
      const currentCount = (newAssignments[projectName] || []).length;
      if (currentCount < maxProjectSize) {
        if (!newAssignments[projectName]) {
          newAssignments[projectName] = [];
        }
        newAssignments[projectName] = [...newAssignments[projectName], studentId];
      }

      return newAssignments;
    });
  };

  const handleStudentRemove = (studentId: string, projectName: string) => {
    setProjectAssignments((prev) => {
      const newAssignments = { ...prev };
      if (newAssignments[projectName]) {
        newAssignments[projectName] = newAssignments[projectName].filter((id) => id !== studentId);
      }
      return newAssignments;
    });
  };

  const handleAddStudentsToProject = (projectName: string, studentNames: string[]) => {
    setProjectAssignments((prev) => {
      const newAssignments = { ...prev };
      const currentCount = (newAssignments[projectName] || []).length;
      const availableSlots = maxProjectSize - currentCount;
      
      if (availableSlots <= 0) return prev;

      // Find student IDs by name
      const studentIdsToAdd: string[] = [];
      for (const studentName of studentNames) {
        if (studentIdsToAdd.length >= availableSlots) break;
        const student = students.find((s) => s.name === studentName);
        if (student) {
          // Check if student is already assigned
          const isAlreadyAssigned = Object.values(newAssignments).some((ids) =>
            ids.includes(student.id)
          );
          if (!isAlreadyAssigned) {
            studentIdsToAdd.push(student.id);
          }
        }
      }

      if (studentIdsToAdd.length > 0) {
        if (!newAssignments[projectName]) {
          newAssignments[projectName] = [];
        }
        newAssignments[projectName] = [...newAssignments[projectName], ...studentIdsToAdd];
      }

      return newAssignments;
    });
  };

  const [unassignedCount, setUnassignedCount] = useState(0);
  const [studentsSearchQuery, setStudentsSearchQuery] = useState(loaded?.studentsSearchQuery ?? "");
  const [projectsSearchQuery, setProjectsSearchQuery] = useState(loaded?.projectsSearchQuery ?? "");

  const handleDragStart = () => {
    // Drag started - handled by browser drag API
  };

  // Persist state to localStorage (debounced) so refresh doesn't lose work.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const payload: PersistedState = {
        students,
        projects,
        projectAssignments: normalizeAssignments(projects, projectAssignments),
        maxProjectSize,
        autoFillMode,
        studentsSearchQuery,
        projectsSearchQuery,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }, 750);

    return () => window.clearTimeout(handle);
  }, [
    students,
    projects,
    projectAssignments,
    maxProjectSize,
    autoFillMode,
    studentsSearchQuery,
    projectsSearchQuery,
  ]);

  const handleClearSavedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStudents([]);
    setProjects([]);
    setProjectAssignments({});
    setStudentsSearchQuery("");
    setProjectsSearchQuery("");
    setMaxProjectSize(6);
    setAutoFillMode("firstChoiceOnly");
    setSettingsOpen(false);
  };

  const handleExportXlsx = async () => {
    const { header, rows } = buildRoundTripExport({
      students,
      projectAssignments,
    });

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    XLSX.utils.book_append_sheet(wb, sheet, "Group Maker");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `group-maker-assignments-${stamp}.xlsx`);
  };

  const panels: Panel[] = [
    {
      id: "students",
      title: "Unassigned Students",
      titleSuffix: <span className="header-count">({unassignedCount})</span>,
      headerContent: (
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={studentsSearchQuery}
          onChange={(e) => setStudentsSearchQuery(e.target.value)}
          className="header-search-input"
        />
      ),
      content: (
        <StudentsPane
          students={students}
          assignedStudentIds={assignedStudentIds}
          projectAssignments={projectAssignments}
          onDragStart={handleDragStart}
          onUnassignedCountChange={setUnassignedCount}
          searchQuery={studentsSearchQuery}
        />
      ),
    },
    {
      id: "projects",
      title: "Projects",
      headerContent: (
        <input
          type="text"
          placeholder="Search projects..."
          value={projectsSearchQuery}
          onChange={(e) => setProjectsSearchQuery(e.target.value)}
          className="header-search-input"
        />
      ),
      content: (
        <ProjectsPane
          projects={projects}
          projectAssignments={projectAssignments}
          students={students}
          onStudentDrop={handleStudentDrop}
          onStudentRemove={handleStudentRemove}
          searchQuery={projectsSearchQuery}
          maxChoices={Math.max(...students.map((s) => s.choices.length), 0)}
          maxStudentsPerProject={maxProjectSize}
        />
      ),
    },
    {
      id: "analysis",
      title: "Project Analysis",
      content: (
        <AnalysisPane
          students={students}
          projects={projects}
          projectAssignments={projectAssignments}
          onAddStudentsToProject={handleAddStudentsToProject}
        />
      ),
    },
  ];

  return (
    <div className="main-app">
      <header className="app-header">
        <h1 className="app-title">GroupMatch</h1>
        <div className="header-actions">
          <div className="header-upload">
            <CSVUpload onUpload={handleCSVUpload} />
          </div>
          <button
            className="settings-btn"
            onClick={handleExportXlsx}
            title="Export assignments to XLSX"
            type="button"
          >
            <Download size={16} />
          </button>
          <button
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            type="button"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>
      <div className="app-content">
        <SimpleToggleLayout panels={panels} />
      </div>

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2 className="settings-title">Settings</h2>
              <button
                className="settings-close"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="settings-body">
              <label className="settings-row">
                <span className="settings-label">Max project size</span>
                <input
                  className="settings-input"
                  type="number"
                  min={1}
                  value={maxProjectSize}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setMaxProjectSize(Number.isFinite(next) ? Math.max(1, next) : 1);
                  }}
                />
              </label>

              <div className="settings-spacer" />

              <div className="settings-row">
                <div className="settings-row-left">
                  <span className="settings-label">Auto-fill algorithm</span>
                  <div className="settings-help">
                    {autoFillMode === "minFillGreedyRepair"
                      ? "Greedy + repair with a 60% minimum-fill rule: uses a subset of projects, seeds each used project to ≥60% full, then improves preference satisfaction with quick swaps."
                      : autoFillMode === "firstChoiceOnly"
                        ? "Simple: assigns each student to their 1st choice (if capacity allows). Everything else is left for manual fixes."
                        : "No auto-fill: starts with all students unassigned."}
                  </div>
                </div>
                <select
                  className="settings-input settings-select"
                  value={autoFillMode}
                  onChange={(e) => setAutoFillMode(e.target.value as AutoFillMode)}
                >
                  <option value="none">No auto-fill</option>
                  <option value="minFillGreedyRepair">Greedy + repair (min-fill)</option>
                  <option value="firstChoiceOnly">Simple (1st choice only)</option>
                </select>
              </div>

              <div className="settings-spacer" />

              <div className="settings-row">
                <div className="settings-row-left">
                  <span className="settings-label">Reset</span>
                  <div className="settings-help">
                    Clears saved data from this browser (students, projects, assignments, and settings).
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-danger-btn"
                  onClick={handleClearSavedData}
                >
                  Clear saved data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
