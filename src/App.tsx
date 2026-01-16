import { useMemo, useState, useEffect } from "react";
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
  firstChoiceStudents: string[];
  secondChoiceStudents: string[];
  thirdChoiceStudents: string[];
  fourthChoiceStudents: string[];
  fifthChoiceStudents: string[];
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    project: string;
    choice: number;
    students: string[];
  } | null>(null);
  const [hoveredStudent, setHoveredStudent] = useState<Student | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedStudents = localStorage.getItem("groupMaker_students");
    const savedGroups = localStorage.getItem("groupMaker_groups");

    if (savedStudents) {
      try {
        const parsed = JSON.parse(savedStudents);
        setStudents(parsed);
      } catch (e) {
        console.error("Error loading students from localStorage:", e);
      }
    }

    if (savedGroups) {
      try {
        const parsed = JSON.parse(savedGroups);
        setGroups(parsed);
      } catch (e) {
        console.error("Error loading groups from localStorage:", e);
      }
    }
  }, []);

  // Auto-save every 2 seconds
  useEffect(() => {
    if (students.length === 0 && groups.length === 0) return;

    const interval = setInterval(() => {
      try {
        localStorage.setItem("groupMaker_students", JSON.stringify(students));
        localStorage.setItem("groupMaker_groups", JSON.stringify(groups));
      } catch (e) {
        console.error("Error auto-saving to localStorage:", e);
      }
    }, 2000); // Save every 2 seconds

    return () => clearInterval(interval);
  }, [students, groups]);

  // Auto-save on page close/reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem("groupMaker_students", JSON.stringify(students));
        localStorage.setItem("groupMaker_groups", JSON.stringify(groups));
      } catch (e) {
        console.error("Error auto-saving to localStorage:", e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        try {
          localStorage.setItem("groupMaker_students", JSON.stringify(students));
          localStorage.setItem("groupMaker_groups", JSON.stringify(groups));
        } catch (e) {
          console.error("Error auto-saving to localStorage:", e);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [students, groups]);

  // Save to localStorage (with alert for manual save)
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem("groupMaker_students", JSON.stringify(students));
      localStorage.setItem("groupMaker_groups", JSON.stringify(groups));
      alert("Data saved successfully!");
    } catch (e) {
      console.error("Error saving to localStorage:", e);
      alert("Error saving data. Please try again.");
    }
  };

  // Clear localStorage
  const clearLocalStorage = () => {
    if (confirm("Are you sure you want to clear all saved data?")) {
      localStorage.removeItem("groupMaker_students");
      localStorage.removeItem("groupMaker_groups");
      setStudents([]);
      setGroups([]);
      alert("Data cleared!");
    }
  };

  // Export groupings for sharing
  const exportGroupings = () => {
    if (groups.length === 0) {
      alert("No groupings to export!");
      return;
    }

    // Create export data with student identifiers for matching
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      groups: groups.map((group) => ({
        project: group.project,
        students: group.students.map((studentId) => {
          const student = findStudentById(studentId);
          if (!student) return null;
          return {
            name: student.name,
            netid: student.netid,
            email: student.email,
          };
        }).filter(Boolean),
      })),
    };

    // Convert to JSON and create download
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groupings-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("Groupings exported successfully! Share this file with others.");
  };

  // Import groupings from exported file
  const importGroupings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (students.length === 0) {
      alert("Please upload a CSV file first before importing groupings!");
      event.target.value = ""; // Reset input
      return;
    }

    file.text().then((text) => {
      try {
        const importData = JSON.parse(text);

        if (!importData.groups || !Array.isArray(importData.groups)) {
          alert("Invalid export file format!");
          event.target.value = "";
          return;
        }

        // Create a map of students by name, netid, and email for matching
        const studentMap = new Map<string, Student>();
        students.forEach((student) => {
          // Use multiple keys for matching
          studentMap.set(student.name.toLowerCase(), student);
          studentMap.set(student.netid.toLowerCase(), student);
          studentMap.set(student.email.toLowerCase(), student);
        });

        // Recreate groups with matched students
        const importedGroups: Group[] = importData.groups.map((importGroup: any, idx: number) => {
          const matchedStudentIds: string[] = [];

          importGroup.students.forEach((importStudent: any) => {
            // Try to match by name, netid, or email
            const matchedStudent =
              studentMap.get(importStudent.name?.toLowerCase() || "") ||
              studentMap.get(importStudent.netid?.toLowerCase() || "") ||
              studentMap.get(importStudent.email?.toLowerCase() || "");

            if (matchedStudent && !matchedStudentIds.includes(matchedStudent.id)) {
              matchedStudentIds.push(matchedStudent.id);
            }
          });

          return {
            id: String(idx),
            project: importGroup.project,
            students: matchedStudentIds,
          };
        });

        // Get all projects from imported data and existing groups
        const importedProjects = new Set(importedGroups.map((g: Group) => g.project));
        const existingProjects = new Set(groups.map((g) => g.project));
        
        // Also get all projects from students' choices to ensure we have all projects
        const allChoiceProjects = new Set<string>();
        students.forEach((s) => s.choices.forEach((c) => allChoiceProjects.add(c)));
        
        // Combine all projects
        const allProjects = new Set([...existingProjects, ...importedProjects, ...allChoiceProjects]);
        const finalGroups: Group[] = [];
        let groupIdCounter = 0;

        allProjects.forEach((project) => {
          const importedGroup = importedGroups.find((g: Group) => g.project === project);
          const existingGroup = groups.find((g) => g.project === project);

          if (importedGroup) {
            // Use imported group (with matched students)
            finalGroups.push({
              ...importedGroup,
              id: String(groupIdCounter++),
            });
          } else if (existingGroup) {
            // Keep existing group
            finalGroups.push({
              ...existingGroup,
              id: String(groupIdCounter++),
            });
          } else {
            // New project (from choices but not in import or existing)
            finalGroups.push({
              id: String(groupIdCounter++),
              project,
              students: [],
            });
          }
        });

        setGroups(finalGroups);
        const totalMatched = importedGroups.reduce((sum, g) => sum + g.students.length, 0);
        alert(
          `Successfully imported ${importedGroups.length} groups! ${totalMatched} students matched and assigned.`
        );
        event.target.value = ""; // Reset input
      } catch (e) {
        console.error("Error importing groupings:", e);
        alert("Error importing file. Please make sure it's a valid export file.");
        event.target.value = "";
      }
    });
  };

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

    // Auto-assign students to their first choice
    const groupsWithStudents = newGroups.map((group) => {
      const studentsForThisProject = newStudents
        .filter((s) => s.choices[0] === group.project)
        .map((s) => s.id);
      return {
        ...group,
        students: studentsForThisProject,
      };
    });

    setGroups(groupsWithStudents);

    // Auto-save after CSV parsing
    setTimeout(() => {
      localStorage.setItem("groupMaker_students", JSON.stringify(newStudents));
      localStorage.setItem("groupMaker_groups", JSON.stringify(groupsWithStudents));
    }, 100);
  }

  const unassignedStudents = useMemo(() => {
    const assigned = new Set(groups.flatMap((g) => g.students));
    const filtered = students
      .filter((s) => !assigned.has(s.id))
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.netid.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const a1 = a.choices[0] || "";
        const b1 = b.choices[0] || "";
        return a1.localeCompare(b1);
      });
    return filtered;
  }, [students, groups, searchQuery]);

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
        firstChoiceStudents: [],
        secondChoiceStudents: [],
        thirdChoiceStudents: [],
        fourthChoiceStudents: [],
        fifthChoiceStudents: [],
      });
    });

    // Count choices and collect student names
    students.forEach((student) => {
      student.choices.forEach((choice, index) => {
        const stats = statsMap.get(choice);
        if (stats) {
          if (index === 0) {
            stats.firstChoice++;
            stats.firstChoiceStudents.push(student.name);
          } else if (index === 1) {
            stats.secondChoice++;
            stats.secondChoiceStudents.push(student.name);
          } else if (index === 2) {
            stats.thirdChoice++;
            stats.thirdChoiceStudents.push(student.name);
          } else if (index === 3) {
            stats.fourthChoice++;
            stats.fourthChoiceStudents.push(student.name);
          } else if (index === 4) {
            stats.fifthChoice++;
            stats.fifthChoiceStudents.push(student.name);
          }
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
        // Allow more than 6 students (can be manually adjusted)
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

  const onAssignToProject = (studentId: string, projectId: string) => {
    if (!projectId || projectId === "") return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== projectId) return g;
        // Check if student is already in this group
        if (g.students.includes(studentId)) return g;
        return { ...g, students: [...g.students, studentId] };
      })
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Group Maker</h1>
        <div className="header-actions">
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
          <button onClick={saveToLocalStorage} className="save-btn">
            💾 Save Progress
          </button>
          {groups.length > 0 && (
            <button onClick={exportGroupings} className="export-btn">
              📤 Export Groupings
            </button>
          )}
          <label className="import-btn-label">
            <input
              type="file"
              accept=".json"
              onChange={importGroupings}
              style={{ display: "none" }}
            />
            <span className="import-btn">📥 Import Groupings</span>
          </label>
          {(students.length > 0 || groups.length > 0) && (
            <button onClick={clearLocalStorage} className="clear-btn">
              🗑️ Clear Data
            </button>
          )}
        </div>
      </header>

      <div className="main-layout">
        {/* LEFT HALF - Current Content */}
        <div className="left-panel">
          <div className="panel-section">
            <h3>Unassigned Students</h3>
            <input
              type="text"
              placeholder="Search by name, NetID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="student-list">
              {unassignedStudents.length === 0 ? (
                <p className="empty-state">
                  {searchQuery.trim()
                    ? "No students found matching your search"
                    : "No unassigned students"}
                </p>
              ) : (
                unassignedStudents.map((s) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggedStudentId(s.id)}
                    className="student-card"
                  >
                    <div className="student-info">
                      <div className="student-name">{s.name}</div>
                      <div className="student-netid">{s.netid}</div>
                      <div className="student-choices">
                        {s.choices.length > 0
                          ? s.choices.map((choice, idx) => `${idx + 1}. ${choice}`).join(" • ")
                          : "No choices listed"}
                      </div>
                    </div>
                    <select
                      className="project-select"
                      value=""
                      onChange={(e) => {
                        e.stopPropagation();
                        onAssignToProject(s.id, e.target.value);
                        e.target.value = ""; // Reset dropdown
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      draggable={false}
                    >
                      <option value="">Assign to project...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.project} ({g.students.length}/6{g.students.length > 6 ? " ⚠️" : ""})
                        </option>
                      ))}
                    </select>
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
                  className={`project-box ${
                    g.students.length > 6
                      ? "project-overflow"
                      : g.students.length === 6
                        ? "project-full"
                        : ""
                  }`}
                >
                  <div className="project-header">
                    <h4 className="project-title">{g.project}</h4>
                    <span
                      className={`project-count ${
                        g.students.length > 6 ? "project-count-overflow" : ""
                      }`}
                    >
                      {g.students.length}/6{g.students.length > 6 ? " ⚠️" : ""}
                    </span>
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
                            <span
                              className="student-name-hoverable"
                              onMouseEnter={() => setHoveredStudent(s)}
                              onMouseLeave={() => setHoveredStudent(null)}
                            >
                              {s.name}
                            </span>
                            {hoveredStudent?.id === s.id && (
                              <div className="student-tooltip">
                                <div className="tooltip-content">
                                  <div className="tooltip-detail">
                                    {s.name} ({s.netid})
                                  </div>
                                  <div className="tooltip-choices">
                                    {s.choices.map((choice, idx) => (
                                      <div key={idx} className="tooltip-choice-item">
                                        {idx + 1}. {choice}
                                      </div>
                                    ))}
                                    {s.choices.length === 0 && (
                                      <div className="tooltip-choice-item">No choices listed</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
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
                    <div
                      className="stat-col stat-col-hoverable"
                      onMouseEnter={() =>
                        setHoveredTooltip({
                          project: stat.project,
                          choice: 1,
                          students: stat.firstChoiceStudents,
                        })
                      }
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      {stat.firstChoice}
                      {hoveredTooltip?.project === stat.project &&
                        hoveredTooltip?.choice === 1 && (
                          <div className="tooltip">
                            <div className="tooltip-content">
                              {stat.firstChoiceStudents.length > 0
                                ? stat.firstChoiceStudents.join(", ")
                                : "None"}
                            </div>
                          </div>
                        )}
                    </div>
                    <div
                      className="stat-col stat-col-hoverable"
                      onMouseEnter={() =>
                        setHoveredTooltip({
                          project: stat.project,
                          choice: 2,
                          students: stat.secondChoiceStudents,
                        })
                      }
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      {stat.secondChoice}
                      {hoveredTooltip?.project === stat.project &&
                        hoveredTooltip?.choice === 2 && (
                          <div className="tooltip">
                            <div className="tooltip-content">
                              {stat.secondChoiceStudents.length > 0
                                ? stat.secondChoiceStudents.join(", ")
                                : "None"}
                            </div>
                          </div>
                        )}
                    </div>
                    <div
                      className="stat-col stat-col-hoverable"
                      onMouseEnter={() =>
                        setHoveredTooltip({
                          project: stat.project,
                          choice: 3,
                          students: stat.thirdChoiceStudents,
                        })
                      }
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      {stat.thirdChoice}
                      {hoveredTooltip?.project === stat.project &&
                        hoveredTooltip?.choice === 3 && (
                          <div className="tooltip">
                            <div className="tooltip-content">
                              {stat.thirdChoiceStudents.length > 0
                                ? stat.thirdChoiceStudents.join(", ")
                                : "None"}
                            </div>
                          </div>
                        )}
                    </div>
                    <div
                      className="stat-col stat-col-hoverable"
                      onMouseEnter={() =>
                        setHoveredTooltip({
                          project: stat.project,
                          choice: 4,
                          students: stat.fourthChoiceStudents,
                        })
                      }
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      {stat.fourthChoice}
                      {hoveredTooltip?.project === stat.project &&
                        hoveredTooltip?.choice === 4 && (
                          <div className="tooltip">
                            <div className="tooltip-content">
                              {stat.fourthChoiceStudents.length > 0
                                ? stat.fourthChoiceStudents.join(", ")
                                : "None"}
                            </div>
                          </div>
                        )}
                    </div>
                    <div
                      className="stat-col stat-col-hoverable"
                      onMouseEnter={() =>
                        setHoveredTooltip({
                          project: stat.project,
                          choice: 5,
                          students: stat.fifthChoiceStudents,
                        })
                      }
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      {stat.fifthChoice}
                      {hoveredTooltip?.project === stat.project &&
                        hoveredTooltip?.choice === 5 && (
                          <div className="tooltip">
                            <div className="tooltip-content">
                              {stat.fifthChoiceStudents.length > 0
                                ? stat.fifthChoiceStudents.join(", ")
                                : "None"}
                            </div>
                          </div>
                        )}
                    </div>
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
