import { useMemo, useState } from "react";
import Papa from "papaparse";
import "./App.css";

type Student = {
  id: string;
  name: string;
  email: string;
  netid: string;
  choices: string[];
};

type Group = {
  id: string;
  project: string;
  students: string[];
};

type ProjectStats = {
  project: string;
  firstChoice: number;
  secondChoice: number;
  thirdChoice: number;
  fourthChoice: number;
  fifthChoice: number;
  total: number;
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  function parseCSV(csvText: string) {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];

    const newStudents: Student[] = rows.map((row, idx) => {
      const choices = [
        row["First (1) Choice"],
        row["Second (2)  Choice"],
        row["Third (3) Choice"],
        row["Fourth (4) Choice"],
        row["Fifth (5) Choice"],
      ].filter(Boolean);

      return {
        id: String(idx),
        name: row["Name"] || "Unknown",
        email: row["Email Address"] || "Unknown",
        netid: row["Your UW NetId"] || "Unknown",
        choices,
      };
    });

    setStudents(newStudents);

    // Build project bubbles from all choices
    const allProjects = new Set<string>();
    newStudents.forEach((s) => s.choices.forEach((c) => allProjects.add(c)));

    const newGroups: Group[] = Array.from(allProjects).map((project, i) => ({
      id: String(i),
      project,
      students: [],
    }));

    setGroups(newGroups);
  }

  const unassignedStudents = useMemo(() => {
    const assigned = new Set(groups.flatMap((g) => g.students));
    return students
      .filter((s) => !assigned.has(s.id))
      .sort((a, b) => {
        const a1 = a.choices[0] || "";
        const b1 = b.choices[0] || "";
        return a1.localeCompare(b1);
      });
  }, [students, groups]);

  const projectStats = useMemo(() => {
    const statsMap = new Map<string, ProjectStats>();

    // Initialize all projects
    groups.forEach((g) => {
      statsMap.set(g.project, {
        project: g.project,
        firstChoice: 0,
        secondChoice: 0,
        thirdChoice: 0,
        fourthChoice: 0,
        fifthChoice: 0,
        total: 0,
      });
    });

    // Count choices
    students.forEach((student) => {
      student.choices.forEach((choice, index) => {
        const stats = statsMap.get(choice);
        if (stats) {
          if (index === 0) stats.firstChoice++;
          else if (index === 1) stats.secondChoice++;
          else if (index === 2) stats.thirdChoice++;
          else if (index === 3) stats.fourthChoice++;
          else if (index === 4) stats.fifthChoice++;
          stats.total++;
        }
      });
    });

    return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
  }, [students, groups]);

  const findStudentById = (id: string) => students.find((s) => s.id === id);

  const onDropToGroup = (groupId: string) => {
    if (!draggedStudentId) return;

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (g.students.length >= 6) return g; // max 6
        return { ...g, students: [...g.students, draggedStudentId] };
      })
    );

    setDraggedStudentId(null);
  };

  const onRemoveFromGroup = (groupId: string, studentId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, students: g.students.filter((id) => id !== studentId) };
      })
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Group Maker</h1>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then(parseCSV);
          }}
          className="file-input"
        />
      </header>

      <div className="main-layout">
        {/* LEFT HALF - Current Content */}
        <div className="left-panel">
          <div className="panel-section">
            <h3>Unassigned Students</h3>
            <div className="student-list">
              {unassignedStudents.length === 0 ? (
                <p className="empty-state">No unassigned students</p>
              ) : (
                unassignedStudents.map((s) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggedStudentId(s.id)}
                    className="student-card"
                  >
                    <div className="student-name">{s.name}</div>
                    <div className="student-netid">{s.netid}</div>
                    <div className="student-choices">
                      {s.choices.slice(0, 2).join(" → ")}
                      {s.choices.length > 2 && "..."}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel-section">
            <h3>Project Groups</h3>
            <div className="projects-grid">
              {groups.map((g) => (
                <div
                  key={g.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropToGroup(g.id)}
                  className={`project-box ${g.students.length >= 6 ? "project-full" : ""}`}
                >
                  <div className="project-header">
                    <h4 className="project-title">{g.project}</h4>
                    <span className="project-count">{g.students.length}/6</span>
                  </div>
                  <div className="project-students">
                    {g.students.length === 0 ? (
                      <p className="empty-state-small">Drop students here</p>
                    ) : (
                      g.students.map((id) => {
                        const s = findStudentById(id);
                        if (!s) return null;
                        return (
                          <div key={id} className="project-student">
                            <span>{s.name}</span>
                            <button
                              onClick={() => onRemoveFromGroup(g.id, id)}
                              className="remove-btn"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT HALF - Data Analysis */}
        <div className="right-panel">
          <h3>Project Analysis</h3>
          {projectStats.length === 0 ? (
            <p className="empty-state">Upload a CSV file to see analysis</p>
          ) : (
            <div className="analysis-content">
              <div className="stats-table">
                <div className="stats-header">
                  <div className="stat-col project-col">Project</div>
                  <div className="stat-col">1st</div>
                  <div className="stat-col">2nd</div>
                  <div className="stat-col">3rd</div>
                  <div className="stat-col">4th</div>
                  <div className="stat-col">5th</div>
                  <div className="stat-col total-col">Total</div>
                </div>
                {projectStats.map((stat) => (
                  <div
                    key={stat.project}
                    className={`stats-row ${stat.total === 0 ? "no-choices" : ""} ${
                      stat.firstChoice === Math.max(...projectStats.map((s) => s.firstChoice))
                        ? "most-popular"
                        : ""
                    }`}
                  >
                    <div className="stat-col project-col">{stat.project}</div>
                    <div className="stat-col">{stat.firstChoice}</div>
                    <div className="stat-col">{stat.secondChoice}</div>
                    <div className="stat-col">{stat.thirdChoice}</div>
                    <div className="stat-col">{stat.fourthChoice}</div>
                    <div className="stat-col">{stat.fifthChoice}</div>
                    <div className="stat-col total-col">{stat.total}</div>
                  </div>
                ))}
              </div>

              <div className="analysis-summary">
                <div className="summary-card">
                  <h4>Most Popular (1st Choice)</h4>
                  <p className="summary-value">
                    {projectStats.length > 0
                      ? projectStats
                          .filter((s) => s.firstChoice > 0)
                          .sort((a, b) => b.firstChoice - a.firstChoice)[0]?.project || "N/A"
                      : "N/A"}
                  </p>
                  <p className="summary-count">
                    {projectStats.length > 0
                      ? Math.max(...projectStats.map((s) => s.firstChoice))
                      : 0}{" "}
                    first choice{Math.max(...projectStats.map((s) => s.firstChoice)) !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="summary-card">
                  <h4>Unwanted Projects</h4>
                  <div className="unwanted-list">
                    {projectStats
                      .filter((s) => s.total === 0)
                      .map((s) => (
                        <span key={s.project} className="unwanted-tag">
                          {s.project}
                        </span>
                      ))}
                    {projectStats.filter((s) => s.total === 0).length === 0 && (
                      <p className="no-unwanted">All projects have at least one choice</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
