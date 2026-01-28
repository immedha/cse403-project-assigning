import { useMemo, useEffect } from "react";
import "./StudentsPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
  teammateIds?: string[];
};

export type TeamsInfo = {
  studentById: Map<string, Student>;
  teams: Array<{ memberIds: string[]; rankingKey: string }>;
  teamMembersByStudentId: Map<string, string[]>;
  teamIndexByStudentId: Map<string, number>;
  unenforceableByStudentId: Map<string, string[]>;
  teamStyleByIndex: (idx: number) => { backgroundColor: string; borderColor: string; color: string };
};

interface StudentsPaneProps {
  students: Student[];
  assignedStudentIds: Set<string>;
  projectAssignments: Record<string, string[]>; // project name -> array of student IDs
  projects: string[];
  onDragStart: () => void;
  onAssignStudent: (studentId: string, projectName: string | null) => void;
  onUnassignedCountChange?: (count: number) => void;
  searchQuery: string;
  teamsInfo: TeamsInfo;
}

export default function StudentsPane({
  students,
  assignedStudentIds,
  projectAssignments,
  projects,
  onDragStart,
  onAssignStudent,
  onUnassignedCountChange,
  searchQuery,
  teamsInfo,
}: StudentsPaneProps) {
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
    onUnassignedCountChange?.(unassignedCount);
  }, [unassignedCount, onUnassignedCountChange]);

  const displayedStudents = useMemo(() => {
    // When not searching, only show unassigned students.
    // When searching, show all students (assigned and unassigned).
    let filtered = searchQuery.trim()
      ? [...students]
      : students.filter((student) => !assignedStudentIds.has(student.id));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(query) ||
          student.id.toLowerCase().includes(query)
      );
    }

    // Sort by team (team students first), then alphabetically by name.
    // Non-team students come after, alphabetically.
    filtered = filtered.sort((a, b) => {
      const ta = teamsInfo.teamIndexByStudentId.get(a.id);
      const tb = teamsInfo.teamIndexByStudentId.get(b.id);
      const aHasTeam = ta !== undefined;
      const bHasTeam = tb !== undefined;
      if (aHasTeam && bHasTeam) {
        if (ta! !== tb!) return ta! - tb!;
        return a.name.localeCompare(b.name);
      }
      if (aHasTeam && !bHasTeam) return -1;
      if (!aHasTeam && bHasTeam) return 1;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [students, assignedStudentIds, searchQuery, teamsInfo.teamIndexByStudentId]);

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
          const teamIndex = teamsInfo.teamIndexByStudentId.get(student.id);

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
              <div className="student-top-row">
                <div className="student-main">
                  <div className="student-name">{student.name}</div>
                  {teamIndex !== undefined && (
                    <span
                      className="student-team-badge"
                      style={teamsInfo.teamStyleByIndex(teamIndex)}
                      title={`Enforceable Team ${teamIndex + 1}`}
                    >
                      Team {teamIndex + 1}
                    </span>
                  )}
                </div>
                <select
                  className="student-assign-select"
                  value={assignedProject ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onAssignStudent(student.id, v ? v : null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title="Assign student to project"
                >
                  <option value="">Unassigned</option>
                  {[...projects].sort((a, b) => a.localeCompare(b)).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {student.choices.length > 0 && (
                <div className="student-preferences">
                  {student.choices.map((choice, idx) => (
                    <span key={idx} className="preference-badge">
                      {idx + 1}. {choice}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

