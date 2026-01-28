import { useState, useMemo } from "react";
import SimpleToggleLayout from "./components/Layout/SimpleToggleLayout";
import type { Panel } from "./components/Layout/SimpleToggleLayout";
import CSVUpload from "./components/CSVUpload";
import StudentsPane from "./components/StudentsPane";
import ProjectsPane, { MAX_STUDENTS_PER_PROJECT } from "./components/ProjectsPane";
import AnalysisPane from "./components/AnalysisPane";
import "./src/components/Layout/MainApp.css";
import "./src/components/AnalysisPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
};

export default function MainApp() {
  const [students, setStudents] = useState<Student[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  // Track assignments: project name -> array of student IDs
  const [projectAssignments, setProjectAssignments] = useState<Record<string, string[]>>({});

  const handleCSVUpload = (data: {
    students: Student[];
    projects: string[];
  }) => {
    setStudents(data.students);
    setProjects(data.projects);
    // Initialize empty assignments for all projects
    const initialAssignments: Record<string, string[]> = {};
    data.projects.forEach((project) => {
      initialAssignments[project] = [];
    });
    setProjectAssignments(initialAssignments);
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
      if (currentCount < MAX_STUDENTS_PER_PROJECT) {
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
      const availableSlots = MAX_STUDENTS_PER_PROJECT - currentCount;
      
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
  const [studentsSearchQuery, setStudentsSearchQuery] = useState("");
  const [projectsSearchQuery, setProjectsSearchQuery] = useState("");

  const handleDragStart = () => {
    // Drag started - handled by browser drag API
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
        <h1 className="app-title">Group Maker</h1>
        <div className="header-upload">
          <CSVUpload onUpload={handleCSVUpload} />
        </div>
      </header>
      <div className="app-content">
        <SimpleToggleLayout panels={panels} />
      </div>
    </div>
  );
}
