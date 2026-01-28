import { useMemo, useEffect } from "react";
import "./StudentsPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
};

interface StudentsPaneProps {
  students: Student[];
  assignedStudentIds: Set<string>;
  projectAssignments: Record<string, string[]>; // project name -> array of student IDs
  onDragStart: () => void;
  onUnassignedCountChange?: (count: number) => void;
  searchQuery: string;
}

export default function StudentsPane({ students, assignedStudentIds, projectAssignments, onDragStart, onUnassignedCountChange, searchQuery }: StudentsPaneProps) {

  const getStudentProject = (studentId: string): string | null => {
    for (const [project, studentIds] of Object.entries(projectAssignments)) {
      if (studentIds.includes(studentId)) {
        return project;
      }
    }
    return null;
  };

  const unassignedCount = useMemo(() => {
    return students.filter((student) => !assignedStudentIds.has(student.id)).length;
  }, [students, assignedStudentIds]);

  useEffect(() => {
    if (onUnassignedCountChange) {
      onUnassignedCountChange(unassignedCount);
    }
  }, [unassignedCount, onUnassignedCountChange]);

  const displayedStudents = useMemo(() => {
    // When not searching, only show unassigned students
    // When searching, show all students (assigned and unassigned)
    let filtered = searchQuery.trim()
      ? [...students] // Show all when searching
      : students.filter((student) => !assignedStudentIds.has(student.id)); // Only unassigned when not searching

    // Sort alphabetically by name
    filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(query) ||
          student.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [students, assignedStudentIds, searchQuery]);

  if (displayedStudents.length === 0) {
    return (
      <div className="students-pane">
        <div className="students-pane-empty">
          <p>No students found. Upload a CSV file to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="students-pane">
      <div className="students-list">
        {displayedStudents.map((student) => {
          const isAssigned = assignedStudentIds.has(student.id);
          const assignedProject = getStudentProject(student.id);

          return (
            <div
              key={student.id}
              className={`student-item ${isAssigned ? "assigned" : ""}`}
              draggable
              onDragStart={(e) => {
                onDragStart();
                e.dataTransfer.setData("text/plain", student.id);
              }}
            >
              <div className="student-name">{student.name}</div>
              {isAssigned && assignedProject && (
                <div className="student-assigned">{assignedProject}</div>
              )}
              {student.choices.length > 0 && (
                <div className="student-preferences">
                  {student.choices.slice(0, 3).map((choice, idx) => (
                    <span key={idx} className="preference-badge">
                      {idx + 1}. {choice}
                    </span>
                  ))}
                  {student.choices.length > 3 && (
                    <span className="preference-more">+{student.choices.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
