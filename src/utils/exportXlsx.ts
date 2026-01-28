import type { StudentLike } from "./autoAssign";
git
type ExportStudent = StudentLike & { teammateIds?: string[] };

export function buildRoundTripExport(params: {
  students: ExportStudent[];
  projectAssignments: Record<string, string[]>;
}) {
  const { students, projectAssignments } = params;

  const studentToProject = new Map<string, string>();
  Object.entries(projectAssignments).forEach(([project, ids]) => {
    (ids || []).forEach((id) => {
      if (!studentToProject.has(id)) studentToProject.set(id, project);
    });
  });

  const maxChoices = Math.max(...students.map((s) => s.choices.length), 0);
  const maxTeamMembers = Math.max(...students.map((s) => (s.teammateIds ?? []).length), 0);
  const header = [
    "Name",
    "Id",
    ...Array.from({ length: maxChoices }, (_, i) => `Choice ${i + 1}`),
    ...Array.from({ length: maxTeamMembers }, (_, i) => `Team Member ${i + 1}`),
    "Assigned Project",
  ];

  const rows: Array<Array<string>> = students.map((s) => {
    const assignedProject = studentToProject.get(s.id) ?? "";
    const choices = Array.from({ length: maxChoices }, (_, i) => s.choices[i] ?? "");
    const teammateIds = Array.from({ length: maxTeamMembers }, (_, i) => s.teammateIds?.[i] ?? "");
    return [s.name, s.id, ...choices, ...teammateIds, assignedProject];
  });

  rows.sort((a, b) => {
    // Assigned Project is last column.
    const byProject = (a[a.length - 1] || "").localeCompare(b[b.length - 1] || "");
    if (byProject !== 0) return byProject;
    return (a[0] || "").localeCompare(b[0] || "");
  });

  return { header, rows };
}

