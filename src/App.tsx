import { useEffect, useMemo, useState } from "react";
import SimpleToggleLayout from "./components/Layout/SimpleToggleLayout";
import type { Panel } from "./components/Layout/SimpleToggleLayout";
import CSVUpload from "./components/CSVUpload";
import StudentsPane from "./components/StudentsPane";
import ProjectsPane from "./components/ProjectsPane";
import AnalysisPane from "./components/AnalysisPane";
import { Download, Settings, X, RotateCcw } from "lucide-react";
import { autoAssign, type AutoFillMode } from "./utils/autoAssign";
import { buildRoundTripExport } from "./utils/exportXlsx";
import { computeTeamsFromCsvStudents } from "./utils/teams";
import "./components/Layout/MainApp.css";
import "./components/AnalysisPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
  teammateIds?: string[];
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
  assignmentToastsEnabled: boolean;
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
    if (typeof data.assignmentToastsEnabled !== "boolean") return null;
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

function enforceTeamsInAssignments(params: {
  assignments: Record<string, string[]>;
  teamMembersByStudentId: Map<string, string[]>;
  capacity: number;
}): Record<string, string[]> {
  const { assignments, teamMembersByStudentId, capacity } = params;
  const next: Record<string, string[]> = {};
  Object.keys(assignments).forEach((p) => (next[p] = [...(assignments[p] || [])]));

  const processedTeams = new Set<string>();
  const allStudents = new Set<string>();
  Object.values(next).forEach((ids) => ids.forEach((id) => allStudents.add(id)));

  const findProjectOf = (id: string) => {
    for (const [p, ids] of Object.entries(next)) {
      if (ids.includes(id)) return p;
    }
    return null;
  };

  for (const id of allStudents) {
    const team = teamMembersByStudentId.get(id);
    if (!team || team.length < 2) continue;
    const teamKey = team.join("|");
    if (processedTeams.has(teamKey)) continue;
    processedTeams.add(teamKey);

    // Pick a target project: first project any member is currently assigned to
    let target: string | null = null;
    for (const m of team) {
      const p = findProjectOf(m);
      if (p) {
        target = p;
        break;
      }
    }
    if (!target) continue;

    // Compute available space in target excluding team members already there
    const cur = next[target] || [];
    const teamSet = new Set(team);
    const withoutTeam = cur.filter((x) => !teamSet.has(x));
    if (withoutTeam.length + team.length > capacity) {
      // Can't keep team together here -> unassign whole team
      for (const p of Object.keys(next)) {
        next[p] = next[p].filter((x) => !teamSet.has(x));
      }
      continue;
    }

    // Remove team from all projects, then assign all to target
    for (const p of Object.keys(next)) {
      next[p] = next[p].filter((x) => !teamSet.has(x));
    }
    next[target] = [...withoutTeam, ...team];
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
  const [assignmentToastsEnabled, setAssignmentToastsEnabled] = useState(
    loaded?.assignmentToastsEnabled ?? true
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [lastAssignmentChange, setLastAssignmentChange] = useState<{
    studentIds: string[];
    studentNames: string[];
    fromProject: string | null;
    toProject: string | null;
  } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const teamsInfo = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const rankingKey = (s: Student) => s.choices.join("\u0001");

    const { teams: enforceableTeams, unenforceableByStudentId } = computeTeamsFromCsvStudents({
      students: students.map((s) => ({
        id: s.id,
        // Ensure teammate columns are treated as an unordered set.
        teammateIds: Array.from(new Set((s.teammateIds ?? []).map((x) => String(x).trim()))).sort((a, b) =>
          a.localeCompare(b)
        ),
      })),
    });

    const teamMembersByStudentId = new Map<string, string[]>();
    const teamIndexByStudentId = new Map<string, number>();
    const teams: Array<{ memberIds: string[]; rankingKey: string }> = [];
    enforceableTeams.forEach((t) => {
      const memberIds = [...t.memberIds].sort();
      const key = rankingKey(studentById.get(memberIds[0])!);
      const idx = teams.length;
      teams.push({ memberIds, rankingKey: key });
      memberIds.forEach((id) => teamMembersByStudentId.set(id, memberIds));
      memberIds.forEach((id) => teamIndexByStudentId.set(id, idx));
    });

    const teamStyleByIndex = (idx: number) => {
      // Avoid red/yellow/green hues to reduce confusion with satisfaction badges.
      // Also ensure we can generate lots of unique colors (20+ teams) deterministically.
      const forbidden: Array<[number, number]> = [
        [0, 16], // reds
        [340, 360], // reds
        [35, 72], // yellows / amber
        [95, 155], // greens
      ];
      const isForbidden = (h: number) =>
        forbidden.some(([a, b]) => (a <= b ? h >= a && h <= b : h >= a || h <= b));

      let hue = (idx * 137.508) % 360; // golden-angle spacing
      // Nudge hue out of forbidden zones (bounded loop; will exit quickly).
      for (let tries = 0; tries < 12 && isForbidden(hue); tries++) {
        hue = (hue + 43) % 360;
      }
      return {
        backgroundColor: `hsl(${hue} 78% 92%)`,
        borderColor: `hsl(${hue} 55% 68%)`,
        color: `hsl(${hue} 40% 26%)`,
      };
    };

    return {
      studentById,
      teams,
      teamMembersByStudentId,
      teamIndexByStudentId,
      unenforceableByStudentId,
      teamStyleByIndex,
    };
  }, [students]);

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
      setLastAssignmentChange(null);
      setToastVisible(false);
      return;
    }

    const base = autoAssign({
      mode: autoFillMode,
      students: data.students,
      projects: data.projects,
      capacity: Math.max(1, maxProjectSize),
      seed: 1,
    });

    const enforced = enforceTeamsInAssignments({
      assignments: base,
      teamMembersByStudentId: new Map(
        computeTeamsFromCsvStudents({
          students: data.students.map((s) => ({
            id: s.id,
            teammateIds: s.teammateIds,
          })),
        }).teams.flatMap((t) => t.memberIds.map((id) => [id, t.memberIds] as const))
      ),
      capacity: Math.max(1, maxProjectSize),
    });

    setProjectAssignments(enforced);
    setLastAssignmentChange(null);
    setToastVisible(false);
  };

  const assignedStudentIds = useMemo(() => {
    const assigned = new Set<string>();
    Object.values(projectAssignments).forEach((studentIds) => {
      studentIds.forEach((id) => assigned.add(id));
    });
    return assigned;
  }, [projectAssignments]);

  const findStudentProject = (assignments: Record<string, string[]>, studentId: string) => {
    for (const [project, ids] of Object.entries(assignments)) {
      if ((ids || []).includes(studentId)) return project;
    }
    return null;
  };

  const handleAssignStudent = (studentId: string, toProject: string | null) => {
    setProjectAssignments((prev) => {
      const newAssignments = { ...prev };
      const studentIds = [studentId];
      const fromProject = findStudentProject(newAssignments, studentId);

      // No-op
      if (fromProject === toProject) return prev;

      // If assigning to a project, ensure capacity BEFORE removing from old project
      if (toProject) {
        const current = newAssignments[toProject] || [];
        const set = new Set(current);
        const addCount = studentIds.filter((id) => !set.has(id)).length;
        if (current.length + addCount > maxProjectSize) {
          return prev;
        }
      }

      // Remove student from any existing project
      Object.keys(newAssignments).forEach((project) => {
        newAssignments[project] = (newAssignments[project] || []).filter((id) => id !== studentId);
      });

      // Add to new project if not unassigning
      if (toProject) {
        const cur = new Set(newAssignments[toProject] || []);
        studentIds.forEach((id) => cur.add(id));
        newAssignments[toProject] = Array.from(cur);
      }

      if (assignmentToastsEnabled) {
        const names = studentIds.map((id) => students.find((s) => s.id === id)?.name ?? "Student");
        setLastAssignmentChange({
          studentIds,
          studentNames: names,
          fromProject,
          toProject,
        });
        setToastVisible(true);
      }

      return newAssignments;
    });
  };

  const handleStudentDrop = (studentId: string, projectName: string) => {
    handleAssignStudent(studentId, projectName);
  };

  const handleStudentRemove = (studentId: string, projectName: string) => {
    setProjectAssignments((prev) => {
      const newAssignments = { ...prev };
      if (newAssignments[projectName]) {
        newAssignments[projectName] = newAssignments[projectName].filter((id) => id !== studentId);
      }

      if (assignmentToastsEnabled) {
        const student = students.find((s) => s.id === studentId);
        setLastAssignmentChange({
          studentIds: [studentId],
          studentNames: [student?.name ?? "Student"],
          fromProject: projectName,
          toProject: null,
        });
        setToastVisible(true);
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

        if (assignmentToastsEnabled && studentIdsToAdd.length > 0) {
          const names = studentIdsToAdd
            .map((id) => students.find((s) => s.id === id)?.name ?? "Student")
            .filter(Boolean);
          setLastAssignmentChange({
            studentIds: studentIdsToAdd,
            studentNames: names,
            fromProject: null,
            toProject: projectName,
          });
          setToastVisible(true);
        }
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
        assignmentToastsEnabled,
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
    assignmentToastsEnabled,
  ]);

  const handleClearSavedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStudents([]);
    setProjects([]);
    setProjectAssignments({});
    setStudentsSearchQuery("");
    setProjectsSearchQuery("");
    setLastAssignmentChange(null);
    setToastVisible(false);
    setSettingsOpen(false);
  };

  const handleUndoLastAssignment = () => {
    if (!lastAssignmentChange) return;
    const { studentIds, fromProject, toProject } = lastAssignmentChange;
    setProjectAssignments((prev) => {
      const next = { ...prev };
      for (const studentId of studentIds) {
        // Remove from current project if needed
        if (toProject && next[toProject]) {
          next[toProject] = next[toProject].filter((id) => id !== studentId);
        }
        // Restore to previous project if there was one
        if (fromProject) {
          const arr = next[fromProject] ?? [];
          if (!arr.includes(studentId)) {
            next[fromProject] = [...arr, studentId];
          }
        }
      }
      return next;
    });
    setToastVisible(false);
  };

  const handleCloseToast = () => {
    setToastVisible(false);
  };

  const closeExportMenu = () => setExportMenuOpen(false);

  // Close export menu on outside click / escape
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExportMenu();
    };
    const onMouseDown = () => closeExportMenu();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [exportMenuOpen]);

  // Auto-dismiss toast after timeout
  useEffect(() => {
    if (!toastVisible || !assignmentToastsEnabled) return;
    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastVisible, assignmentToastsEnabled]);

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

  const handleExportCsv = () => {
    const { header, rows } = buildRoundTripExport({
      students,
      projectAssignments,
    });

    const escapeCsv = (value: string) => {
      const v = value ?? "";
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const csv = [header, ...rows]
      .map((row) => row.map((c) => escapeCsv(String(c ?? ""))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `group-maker-assignments-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          projects={projects}
          onDragStart={handleDragStart}
          onAssignStudent={handleAssignStudent}
          onUnassignedCountChange={setUnassignedCount}
          searchQuery={studentsSearchQuery}
          teamsInfo={teamsInfo}
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
          teamsInfo={teamsInfo}
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
          teamsInfo={teamsInfo}
        />
      ),
    },
  ];

  return (
    <div className="main-app">
      <header className="app-header">
        <h1 className="app-title">ProjectMatcher</h1>
        <div className="header-actions">
          <div className="header-upload">
            <CSVUpload onUpload={handleCSVUpload} />
          </div>
          <div className="export-menu-wrapper" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="settings-btn"
              onClick={() => setExportMenuOpen((v) => !v)}
              title="Export"
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
            >
              <Download size={16} />
            </button>
            {exportMenuOpen && (
              <div className="export-menu" role="menu">
                <button
                  type="button"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    handleExportCsv();
                    closeExportMenu();
                  }}
                >
                  Export csv
                </button>
                <button
                  type="button"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    void handleExportXlsx();
                    closeExportMenu();
                  }}
                >
                  Export xlsx
                </button>
              </div>
            )}
          </div>
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
                        ? "Simple algo: assigns each student to their 1st choice (if capacity allows). Everything else is left for manual fixes."
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
                  <span className="settings-label">Toast notifications</span>
                  <div className="settings-help">
                    Show a small notification with an Undo option whenever a project assignment changes.
                  </div>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={assignmentToastsEnabled}
                    onChange={(e) => setAssignmentToastsEnabled(e.target.checked)}
                  />
                  <span>Enable</span>
                </label>
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

      {assignmentToastsEnabled && toastVisible && lastAssignmentChange && (
        <div className="toast-container">
          <div className="toast">
            <div className="toast-text">
              <span className="toast-student">
                {lastAssignmentChange.studentNames.join(", ")}
              </span>
              <span className="toast-arrow">→</span>
              <span className="toast-project">
                {lastAssignmentChange.toProject ?? "Unassigned"}
              </span>
              {lastAssignmentChange.fromProject && (
                <span className="toast-subtext">
                  (from {lastAssignmentChange.fromProject})
                </span>
              )}
            </div>
            <button
              type="button"
              className="toast-undo-btn"
              onClick={handleUndoLastAssignment}
              title="Undo"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="toast-close-btn"
              onClick={handleCloseToast}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
