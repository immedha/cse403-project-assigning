import type { StudentLike } from "./autoAssign";

export function buildRoundTripExport(params: {
  students: StudentLike[];
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
  const header = [
    "Assigned Project",
    "Name",
    "Id",
    ...Array.from({ length: maxChoices }, (_, i) => `Choice ${i + 1}`),
  ];

  const rows: Array<Array<string>> = students.map((s) => {
    const assignedProject = studentToProject.get(s.id) ?? "";
    const choices = Array.from({ length: maxChoices }, (_, i) => s.choices[i] ?? "");
    return [assignedProject, s.name, s.id, ...choices];
  });

  rows.sort((a, b) => {
    const byProject = (a[0] || "").localeCompare(b[0] || "");
    if (byProject !== 0) return byProject;
    return (a[1] || "").localeCompare(b[1] || "");
  });

  return { header, rows };
}

