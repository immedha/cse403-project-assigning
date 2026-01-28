import type { StudentLike } from "./autoAssign";

export function buildAssignmentsExport(params: {
  students: StudentLike[];
  projectAssignments: Record<string, string[]>;
}) {
  const { students, projectAssignments } = params;

  const studentById = new Map(students.map((s) => [s.id, s]));

  // [Project, Name, ID]
  const assignedRows: Array<[string, string, string]> = [];
  const assignedSet = new Set<string>();

  const projects = Object.keys(projectAssignments).sort((a, b) => a.localeCompare(b));
  for (const project of projects) {
    const ids = projectAssignments[project] || [];
    for (const id of ids) {
      const s = studentById.get(id);
      if (!s) continue;
      assignedSet.add(id);
      assignedRows.push([project, s.name, s.id]);
    }
  }

  assignedRows.sort((a, b) => {
    const byProject = a[0].localeCompare(b[0]);
    if (byProject !== 0) return byProject;
    return a[1].localeCompare(b[1]);
  });

  const unassignedRows: Array<[string, string]> = [];
  for (const s of students) {
    if (!assignedSet.has(s.id)) unassignedRows.push([s.name, s.id]);
  }
  unassignedRows.sort((a, b) => a[0].localeCompare(b[0]));

  return { assignedRows, unassignedRows };
}

