import { useMemo, useState } from "react";
import "./ProjectsPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
};

interface ProjectsPaneProps {
  projects: string[];
  projectAssignments: Record<string, string[]>; // project name -> array of student IDs
  students: Student[];
  onStudentDrop: (studentId: string, projectName: string) => void;
  onStudentRemove: (studentId: string, projectName: string) => void;
  searchQuery: string;
  maxChoices: number;
  maxStudentsPerProject: number;
}

export default function ProjectsPane({
  projects,
  projectAssignments,
  students,
  onStudentDrop,
  onStudentRemove,
  searchQuery,
  maxChoices,
  maxStudentsPerProject,
}: ProjectsPaneProps) {
  const [studentTooltip, setStudentTooltip] = useState<{
    x: number;
    y: number;
    student: Student;
  } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e: React.DragEvent, projectName: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) {
      onStudentDrop(studentId, projectName);
    }
  };

  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Sort projects alphabetically
    filtered = filtered.sort((a, b) => a.localeCompare(b));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((project) =>
        project.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, searchQuery]);

  const getPreferenceRank = (student: Student, projectName: string): number | null => {
    const index = student.choices.indexOf(projectName);
    // Return null if not in choices, but we'll treat it as 3rd+ in the display
    return index === -1 ? null : index + 1; // 1-based ranking
  };

  if (projects.length === 0) {
    return (
      <div className="projects-pane">
        <div className="projects-pane-empty">
          <p>No projects to display. Upload a CSV file to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-pane">
      <p className="projects-hint">
        <em>Right-click a student to see their detailed rankings.</em>
      </p>
      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="projects-pane-empty">
            <p>No projects found matching your search</p>
          </div>
        ) : (
          filteredProjects.map((project) => {
          const studentIds = projectAssignments[project] || [];
          const projectStudents = studentIds
            .map((id) => students.find((s) => s.id === id))
            .filter((s): s is Student => Boolean(s));
          const isFull = projectStudents.length >= maxStudentsPerProject;
          const isOverCapacity = projectStudents.length > maxStudentsPerProject;

          return (
            <div
              key={project}
              className={`project-card ${isOverCapacity ? "over-capacity" : isFull ? "full" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, project)}
            >
              <div className="project-header">
                <h4 className="project-name">{project}</h4>
                <span className={`project-count ${isOverCapacity ? "over" : ""}`}>
                  {projectStudents.length}/{maxStudentsPerProject}
                  {isOverCapacity && " ⚠️"}
                </span>
              </div>
              <div className="project-students">
                {projectStudents.length === 0 ? (
                  <div className="empty-project-hint">Drop students here</div>
                ) : (
                  projectStudents.map((student) => {
                    const preferenceRank = getPreferenceRank(student, project);
                    return (
                      <div
                        key={student.id}
                        className="project-student"
                        draggable
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setStudentTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            student,
                          });
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", student.id);
                        }}
                      >
                        <div className="student-info">
                          <span className="student-name">{student.name}</span>
                          <span
                            className={`preference-badge ${
                              preferenceRank === 1
                                ? "pref-1"
                                : preferenceRank === 2
                                  ? "pref-2"
                                  : "pref-3plus"
                            }`}
                          >
                            {preferenceRank !== null ? `#${preferenceRank}` : `#${maxChoices + 1}`}
                          </span>
                        </div>
                        <button
                          className="remove-student-btn"
                          onClick={() => onStudentRemove(student.id, project)}
                          title="Remove from project"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
          })
        )}
      </div>
      {studentTooltip && (
        <>
          <div
            className="student-tooltip-backdrop"
            onClick={() => setStudentTooltip(null)}
          />
          <div
            className="student-tooltip"
            style={{ top: studentTooltip.y + 8, left: studentTooltip.x + 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="student-tooltip-title">{studentTooltip.student.name} ({studentTooltip.student.id})</div>
            <div className="student-tooltip-content">
              {studentTooltip.student.choices.length > 0 ? (
                studentTooltip.student.choices.map((c, i) => (
                  <div key={i} className="student-tooltip-line">
                    {i + 1}. {c}
                  </div>
                ))
              ) : (
                <div className="student-tooltip-line">No ranked choices</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
