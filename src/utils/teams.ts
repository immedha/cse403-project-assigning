export type TeamResult = {
  teams: Array<{ memberIds: string[] }>;
  unenforceableByStudentId: Map<string, string[]>;
};

// Build enforceable teams from CSV-parsed students using the rules:
// - Teammate columns are treated as an unordered set.
// - Each student implies a "preferred group" = {self} ∪ teammateIds.
// - Enforceable teams are those group-strings that appear for every member of that group.
// - Students with no teammate prefs (group size 1) are ignored.
export function computeTeamsFromCsvStudents(params: {
  students: Array<{ id: string; teammateIds?: string[] }>;
}): TeamResult {
  const { students } = params;
  const studentById = new Map(students.map((s) => [s.id, s]));

  type Row = {
    studentId: string;
    memberIds: string[]; // sorted, includes self
    groupKey: string; // comma-separated, sorted
  };

  const rows: Row[] = [];
  for (const s of students) {
    const raw = [s.id, ...(s.teammateIds ?? [])].filter(Boolean).map((x) => String(x).trim());
    const memberIds = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
    if (memberIds.length <= 1) continue; // ignore 1-student groups
    rows.push({ studentId: s.id, memberIds, groupKey: memberIds.join(",") });
  }

  // Sort to group identical groupKey strings.
  rows.sort((a, b) => a.groupKey.localeCompare(b.groupKey) || a.studentId.localeCompare(b.studentId));

  const enforceableTeams: Array<{ memberIds: string[] }> = [];
  const enforceableMemberSet = new Set<string>();
  const unenforceableByStudentId = new Map<string, string[]>();

  // Scan runs of identical groupKey.
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].groupKey === rows[i].groupKey) j++;

    const run = rows.slice(i, j);
    const memberIds = run[0].memberIds;

    const allMembersExist = memberIds.every((id) => studentById.has(id));
    const whoChoseIt = new Set(run.map((r) => r.studentId));
    const isEnforceable =
      allMembersExist &&
      whoChoseIt.size === memberIds.length &&
      memberIds.every((id) => whoChoseIt.has(id));

    if (isEnforceable) {
      enforceableTeams.push({ memberIds });
      memberIds.forEach((id) => enforceableMemberSet.add(id));
    } else {
      // Remaining group strings -> unenforceable, keep as student -> team members.
      for (const r of run) {
        // If a student is already part of an enforceable team, we don't list them as unenforceable.
        if (enforceableMemberSet.has(r.studentId)) continue;
        const others = r.memberIds.filter((id) => id !== r.studentId);
        if (others.length) unenforceableByStudentId.set(r.studentId, others);
      }
    }

    i = j;
  }

  // Deterministic ordering for teams.
  enforceableTeams.forEach((t) => t.memberIds.sort());
  enforceableTeams.sort((a, b) => a.memberIds.join("|").localeCompare(b.memberIds.join("|")));

  return { teams: enforceableTeams, unenforceableByStudentId };
}

