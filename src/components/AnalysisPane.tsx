import { useMemo, useState } from "react";
import { Smile, Meh, Frown } from "lucide-react";
import Tooltip from "./Tooltip";
import "./AnalysisPane.css";

export type Student = {
  id: string;
  name: string;
  choices: string[];
};

type ProjectStats = {
  project: string;
  choiceCounts: Map<number, number>; // choice rank -> count
  choiceStudents: Map<number, string[]>; // choice rank -> student names
  total: number;
};

interface AnalysisPaneProps {
  students: Student[];
  projects: string[];
  projectAssignments: Record<string, string[]>; // project name -> array of student IDs
  onAddStudentsToProject?: (project: string, studentNames: string[]) => void;
  teamsInfo: import("./StudentsPane").TeamsInfo;
}

export default function AnalysisPane({
  students,
  projects,
  projectAssignments,
  onAddStudentsToProject,
  teamsInfo,
}: AnalysisPaneProps) {
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    project: string;
    choice: number;
    students: string[];
    element: HTMLElement | null;
  } | null>(null);
  const [totalUpToRank, setTotalUpToRank] = useState<number | null>(null); // null means all ranks
  const [showTeamDetails, setShowTeamDetails] = useState(true);

  const assignedStudentIds = useMemo(() => {
    const assigned = new Set<string>();
    Object.values(projectAssignments).forEach((studentIds) => {
      studentIds.forEach((id) => assigned.add(id));
    });
    return assigned;
  }, [projectAssignments]);

  const projectStats = useMemo(() => {
    const statsMap = new Map<string, ProjectStats>();

    // Initialize all projects
    projects.forEach((project) => {
      statsMap.set(project, {
        project,
        choiceCounts: new Map<number, number>(),
        choiceStudents: new Map<number, string[]>(),
        total: 0,
      });
    });

    // Count choices and collect student names (only for unassigned students)
    students
      .filter((student) => !assignedStudentIds.has(student.id))
      .forEach((student) => {
        student.choices.forEach((choice, index) => {
          const stats = statsMap.get(choice);
          if (stats) {
            const rank = index + 1; // 1-based ranking
            const currentCount = stats.choiceCounts.get(rank) || 0;
            const currentStudents = stats.choiceStudents.get(rank) || [];

            stats.choiceCounts.set(rank, currentCount + 1);
            stats.choiceStudents.set(rank, [...currentStudents, student.name]);
            stats.total++;
          }
        });
      });

    return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
  }, [students, projects, assignedStudentIds]);

  // Calculate satisfaction statistics for assigned students
  // IMPORTANT: must be declared before any early returns (rules of hooks)
  const satisfactionStats = useMemo(() => {
    const assignedStudents = students.filter((student) =>
      assignedStudentIds.has(student.id)
    );

    if (assignedStudents.length === 0) {
      return { first: 0, second: 0, thirdPlus: 0, total: 0 };
    }

    let firstChoice = 0;
    let secondChoice = 0;
    let thirdPlusChoice = 0;

    assignedStudents.forEach((student) => {
      const studentId = student.id;
      // Find which project this student is assigned to
      let assignedProject: string | null = null;
      for (const [project, studentIds] of Object.entries(projectAssignments)) {
        if (studentIds.includes(studentId)) {
          assignedProject = project;
          break;
        }
      }

      if (assignedProject) {
        const rank = student.choices.indexOf(assignedProject);
        if (rank === 0) {
          firstChoice++;
        } else if (rank === 1) {
          secondChoice++;
        } else if (rank >= 2 || rank === -1) {
          // rank === -1 means project not in their choices, count as 3rd+
          thirdPlusChoice++;
        }
      }
    });

    return {
      first: Math.round((firstChoice / assignedStudents.length) * 100),
      second: Math.round((secondChoice / assignedStudents.length) * 100),
      thirdPlus: Math.round((thirdPlusChoice / assignedStudents.length) * 100),
      total: assignedStudents.length,
    };
  }, [students, assignedStudentIds, projectAssignments]);

  const unenforceableEntries = useMemo(() => {
    const entries: Array<{ studentName: string; teammateNames: string }> = [];
    teamsInfo.unenforceableByStudentId.forEach((teammateIds, studentId) => {
      const studentName = teamsInfo.studentById.get(studentId)?.name ?? studentId;
      const teammateNames = teammateIds
        .map((id) => teamsInfo.studentById.get(id)?.name ?? id)
        .join(", ");
      entries.push({ studentName, teammateNames });
    });
    entries.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return entries;
  }, [teamsInfo]);

  if (students.length === 0) {
    return (
      <div className="analysis-pane">
        <div className="empty-state">
          <p>Upload a CSV file to see analysis</p>
        </div>
      </div>
    );
  }

  // Calculate max number of choices across all students
  const maxChoices = Math.max(...students.map((s) => s.choices.length), 0);
  const choiceRanks = Array.from({ length: maxChoices }, (_, i) => i + 1);

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Calculate displayed total for each stat and sort
  const sortedStats = [...projectStats].sort((a, b) => {
    const totalA = totalUpToRank
      ? Array.from({ length: totalUpToRank }, (_, i) => i + 1).reduce(
          (sum, rank) => sum + (a.choiceCounts.get(rank) || 0),
          0
        )
      : a.total;
    const totalB = totalUpToRank
      ? Array.from({ length: totalUpToRank }, (_, i) => i + 1).reduce(
          (sum, rank) => sum + (b.choiceCounts.get(rank) || 0),
          0
        )
      : b.total;
    return totalB - totalA; // Sort greatest to least
  });

  const maxFirstChoice = Math.max(
    ...projectStats.map((s) => s.choiceCounts.get(1) || 0),
    0
  );

  return (
    <div className="analysis-pane">
      {satisfactionStats.total > 0 && (
        <div className="satisfaction-stats">
          <Smile className="satisfaction-icon satisfaction-green" size={16} />
          <span className="satisfaction-value satisfaction-green">{satisfactionStats.first}%</span>
          <Meh className="satisfaction-icon satisfaction-yellow" size={16} />
          <span className="satisfaction-value satisfaction-yellow">{satisfactionStats.second}%</span>
          <Frown className="satisfaction-icon satisfaction-red" size={16} />
          <span className="satisfaction-value satisfaction-red">{satisfactionStats.thirdPlus}%</span>
          <span className="satisfaction-total">
            satisfaction stats (out of {satisfactionStats.total} assigned students)
          </span>
        </div>
      )}
      <div className="analysis-divider" />
      <div className="teams-summary">
        <div className="teams-summary-row">
          <span className="teams-summary-label">Teammate requests</span>
          <button
            type="button"
            className="teams-summary-toggle"
            onClick={() => setShowTeamDetails((v) => !v)}
          >
            {showTeamDetails ? "Hide" : "View"}
          </button>
        </div>
        {showTeamDetails && (
          <div className="teams-summary-details">
            {teamsInfo.teams.length > 0 ? (
              <div className="teams-summary-block">
                <div className="teams-summary-title">Enforceable teams (mutual + identical rankings)</div>
                <ul className="teams-summary-list">
                  {teamsInfo.teams.slice(0, 10).map((t, idx) => (
                    <li key={t.memberIds.join("|")}>
                      <span
                        className="analysis-team-pill"
                        style={teamsInfo.teamStyleByIndex(idx)}
                        title={`Enforceable Team ${idx + 1}`}
                      >
                        Team {idx + 1}
                      </span>{" "}
                      {t.memberIds
                        .map((id) => teamsInfo.studentById.get(id)?.name ?? id)
                        .join(", ")}
                    </li>
                  ))}
                </ul>
                {teamsInfo.teams.length > 10 && (
                  <div className="teams-summary-more">…and {teamsInfo.teams.length - 10} more</div>
                )}
              </div>
            ) : (
              <div className="teams-summary-block">
                <div className="teams-summary-title">Enforceable teams</div>
                <div className="teams-summary-empty">None</div>
              </div>
            )}

            {unenforceableEntries.length > 0 && (
              <div className="teams-summary-block">
                <div className="teams-summary-title">Unenforceable requests</div>
                <ul className="teams-summary-list">
                  {unenforceableEntries.slice(0, 12).map((e, idx) => (
                    <li key={`${e.studentName}-${e.teammateNames}-${idx}`}>
                      {e.studentName} → {e.teammateNames}
                    </li>
                  ))}
                </ul>
                {unenforceableEntries.length > 12 && (
                  <div className="teams-summary-more">
                    …and {unenforceableEntries.length - 12} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="analysis-divider" />
      {hoveredTooltip && hoveredTooltip.element && (
        <>
          <div
            className="tooltip-backdrop"
            onClick={() => setHoveredTooltip(null)}
          />
          <Tooltip
            element={hoveredTooltip.element}
            students={hoveredTooltip.students}
            project={hoveredTooltip.project}
            onAddAll={onAddStudentsToProject}
            onClose={() => setHoveredTooltip(null)}
          />
        </>
      )}
      <div className="analysis-table-title">
        Number of (unassigned) students who ranked each project as 1st, 2nd, 3rd, etc.
      </div>
      <div className="analysis-hint">
        <em>Click on a value in the table to see all the students who gave that ranking for that project.</em>
      </div>
      <div className="stats-table-wrapper">
        <div className="stats-table">
        <div
          className="stats-header"
          style={{
            gridTemplateColumns: `2fr repeat(${maxChoices}, 0.8fr) 1fr`,
          }}
        >
          <div className="stat-col project-col">Project</div>
          {choiceRanks.map((rank) => {
            const isLastRank = rank === choiceRanks[choiceRanks.length - 1];
            const isSelected = totalUpToRank === rank || (totalUpToRank === null && isLastRank);
            return (
              <button
                key={rank}
                className={`choice-header-btn ${
                  isSelected ? "choice-header-btn-selected" : ""
                }`}
                onClick={() => setTotalUpToRank(totalUpToRank === rank ? null : rank)}
                title={`# of unassigned students who ranked this project as their ${getOrdinal(
                  rank
                )} choice. Click to change the Total calculation.`}
                aria-label={`Unassigned students who ranked this project as their ${getOrdinal(
                  rank
                )} choice`}
              >
                {getOrdinal(rank)}
              </button>
            );
          })}
          <div className="stat-col total-col">
            <div>Total</div>
            {totalUpToRank ? (
              <div className="total-sublabel">up to {getOrdinal(totalUpToRank)}</div>
            ) : null}
          </div>
        </div>
        {sortedStats.map((stat) => {
          const firstChoiceCount = stat.choiceCounts.get(1) || 0;
          return (
            <div
              key={stat.project}
              className={`stats-row ${stat.total === 0 ? "no-choices" : ""} ${
                firstChoiceCount === maxFirstChoice && maxFirstChoice > 0
                  ? "most-popular"
                  : ""
              }`}
              style={{
                gridTemplateColumns: `2fr repeat(${maxChoices}, 0.8fr) 1fr`,
              }}
            >
              <div className="stat-col project-col">{stat.project}</div>
              {choiceRanks.map((rank) => {
                const count = stat.choiceCounts.get(rank) || 0;
                const students = stat.choiceStudents.get(rank) || [];
                return (
                  <div
                    key={rank}
                    className="stat-col stat-col-hoverable"
                    onClick={(e) => {
                      // toggle if clicking same cell again
                      if (
                        hoveredTooltip?.element === e.currentTarget &&
                        hoveredTooltip.project === stat.project &&
                        hoveredTooltip.choice === rank
                      ) {
                        setHoveredTooltip(null);
                        return;
                      }
                      setHoveredTooltip({
                        project: stat.project,
                        choice: rank,
                        students: count > 0 ? students : [],
                        element: e.currentTarget,
                      });
                    }}
                  >
                    {count}
                  </div>
                );
              })}
              <div className="stat-col total-col">
                {totalUpToRank
                  ? Array.from({ length: totalUpToRank }, (_, i) => i + 1).reduce(
                      (sum, rank) => sum + (stat.choiceCounts.get(rank) || 0),
                      0
                    )
                  : stat.total}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
