export type StudentLike = {
  id: string;
  name: string;
  choices: string[];
};

export type AutoFillMode = "minFillGreedyRepair" | "firstChoiceOnly" | "none";

type Assignments = Record<string, string[]>;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function preferenceCost(student: StudentLike, project: string, maxChoices: number): number {
  const idx = student.choices.indexOf(project);
  // If not ranked, treat as worst (maxChoices + 1)
  return idx === -1 ? maxChoices : idx; // 0 is best
}

function projectPopularityScore(students: StudentLike[], project: string): number {
  // Higher is better. Earlier ranks contribute more.
  let score = 0;
  for (const s of students) {
    const idx = s.choices.indexOf(project);
    if (idx === -1) continue;
    score += Math.max(1, 100 - idx * 15);
  }
  return score;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function buildEmpty(projectsSorted: string[]): Assignments {
  const a: Assignments = {};
  projectsSorted.forEach((p) => (a[p] = []));
  return a;
}

function autoAssignFirstChoiceOnly(params: {
  students: StudentLike[];
  projects: string[];
  capacity: number;
}): Assignments {
  const { students, projects, capacity } = params;
  const projectsSorted = [...projects].sort((a, b) => a.localeCompare(b));
  const a = buildEmpty(projectsSorted);
  const counts = new Map<string, number>(projectsSorted.map((p) => [p, 0]));

  for (const s of students) {
    const choice = s.choices[0];
    if (!choice) continue;
    if (!counts.has(choice)) continue;
    const c = counts.get(choice) || 0;
    if (c >= capacity) continue;
    a[choice].push(s.id);
    counts.set(choice, c + 1);
  }

  return a;
}

function autoAssignMinFillGreedyRepair(params: {
  students: StudentLike[];
  projects: string[];
  capacity: number;
  seed?: number;
  greedyTries?: number;
  repairPasses?: number;
  minFillRatio?: number;
}): Assignments {
  const {
    students,
    projects,
    capacity,
    seed = 1,
    greedyTries = 12,
    repairPasses = 3000,
    minFillRatio = 0.6,
  } = params;

  const maxChoices = Math.max(...students.map((s) => s.choices.length), 0) || 1;
  const projectsSorted = [...projects].sort((a, b) => a.localeCompare(b));
  const studentById = new Map(students.map((s) => [s.id, s]));

  const scoreAssignments = (assignments: Assignments) => {
    // Lower is better. Unassigned gets a big penalty.
    const assigned = new Set<string>();
    for (const ids of Object.values(assignments)) ids.forEach((id) => assigned.add(id));

    let sum = 0;
    for (const s of students) {
      if (!assigned.has(s.id)) {
        sum += 1000;
        continue;
      }
      for (const [p, ids] of Object.entries(assignments)) {
        if (ids.includes(s.id)) {
          sum += preferenceCost(s, p, maxChoices);
          break;
        }
      }
    }
    return sum;
  };

  const greedyOnceWithMinFill = (order: StudentLike[], activeProjects: string[], minSize: number) => {
    const a = buildEmpty(projectsSorted);
    const active = new Set(activeProjects);
    const counts = new Map<string, number>(projectsSorted.map((p) => [p, 0]));
    const remaining = new Set(order.map((s) => s.id));

    const pickBestStudentForProject = (project: string) => {
      let bestId: string | null = null;
      let bestRank = Number.POSITIVE_INFINITY;
      let bestChoices = -1;

      for (const id of remaining) {
        const s = studentById.get(id);
        if (!s) continue;
        const idx = s.choices.indexOf(project);
        const rank = idx === -1 ? Number.POSITIVE_INFINITY : idx;
        if (rank < bestRank || (rank === bestRank && s.choices.length > bestChoices)) {
          bestRank = rank;
          bestChoices = s.choices.length;
          bestId = id;
        }
      }
      return bestId;
    };

    // Phase 1: seed lower bounds
    for (const project of activeProjects) {
      for (let k = 0; k < minSize; k++) {
        if (remaining.size === 0) break;
        const bestId = pickBestStudentForProject(project);
        if (!bestId) break;
        a[project].push(bestId);
        remaining.delete(bestId);
        counts.set(project, (counts.get(project) || 0) + 1);
      }
    }

    // Phase 2: assign remaining by preference into active projects
    const rest = order.filter((s) => remaining.has(s.id));
    for (const s of rest) {
      let bestChoice: string | null = null;
      let bestRank = Number.POSITIVE_INFINITY;
      let bestFill = Number.POSITIVE_INFINITY;

      for (let r = 0; r < s.choices.length; r++) {
        const choice = s.choices[r];
        if (!active.has(choice)) continue;
        const c = counts.get(choice) || 0;
        if (c >= capacity) continue;
        if (r < bestRank || (r === bestRank && c < bestFill)) {
          bestRank = r;
          bestFill = c;
          bestChoice = choice;
        }
      }

      if (!bestChoice) {
        const open = activeProjects
          .map((p) => ({ p, c: counts.get(p) || 0 }))
          .filter(({ c }) => c < capacity)
          .sort((x, y) => (x.c !== y.c ? x.c - y.c : x.p.localeCompare(y.p)));
        bestChoice = open[0]?.p ?? null;
      }

      if (bestChoice) {
        a[bestChoice].push(s.id);
        counts.set(bestChoice, (counts.get(bestChoice) || 0) + 1);
      }
    }

    return a;
  };

  const repair = (a: Assignments, rand: () => number): Assignments => {
    const studentToProject = new Map<string, string>();
    for (const [p, ids] of Object.entries(a)) ids.forEach((id) => studentToProject.set(id, p));

    const allAssignedIds = Array.from(studentToProject.keys());
    if (allAssignedIds.length < 2) return a;

    const trySwap = (id1: string, id2: string) => {
      const p1 = studentToProject.get(id1);
      const p2 = studentToProject.get(id2);
      if (!p1 || !p2 || p1 === p2) return;
      const s1 = studentById.get(id1);
      const s2 = studentById.get(id2);
      if (!s1 || !s2) return;

      const beforePref = preferenceCost(s1, p1, maxChoices) + preferenceCost(s2, p2, maxChoices);
      const afterPref = preferenceCost(s1, p2, maxChoices) + preferenceCost(s2, p1, maxChoices);
      if (afterPref < beforePref) {
        a[p1] = a[p1].map((x) => (x === id1 ? id2 : x));
        a[p2] = a[p2].map((x) => (x === id2 ? id1 : x));
        studentToProject.set(id1, p2);
        studentToProject.set(id2, p1);
      }
    };

    for (let k = 0; k < repairPasses; k++) {
      const i = Math.floor(rand() * allAssignedIds.length);
      const j = Math.floor(rand() * allAssignedIds.length);
      if (i === j) continue;
      trySwap(allAssignedIds[i], allAssignedIds[j]);
    }
    return a;
  };

  const n = students.length;
  const minSize = Math.max(1, Math.ceil(minFillRatio * capacity));
  const minK = Math.ceil(n / capacity);
  const maxK = Math.floor(n / minSize);
  const feasible = minK <= maxK;

  const popularity = new Map<string, number>(
    projectsSorted.map((p) => [p, projectPopularityScore(students, p)])
  );
  const projectsByPopularity = [...projectsSorted].sort((a, b) => {
    const da = popularity.get(a) ?? 0;
    const db = popularity.get(b) ?? 0;
    return db !== da ? db - da : a.localeCompare(b);
  });

  let best: Assignments | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let t = 0; t < greedyTries; t++) {
    const rand = mulberry32(seed + t * 9973);
    const order = [...students].sort((a, b) => b.choices.length - a.choices.length);
    shuffleInPlace(order, rand);

    let a: Assignments;
    if (minFillRatio > 0 && feasible) {
      const k = clamp(minK, 1, Math.min(projectsSorted.length, maxK));
      const activeProjects = projectsByPopularity.slice(0, k);
      a = greedyOnceWithMinFill(order, activeProjects, minSize);
    } else {
      a = greedyOnceWithMinFill(order, projectsSorted, 0);
    }

    const improved = repair(a, rand);
    const s = scoreAssignments(improved);
    if (s < bestScore) {
      bestScore = s;
      best = improved;
    }
  }

  return best ?? buildEmpty(projectsSorted);
}

export function autoAssign(params: {
  mode: AutoFillMode;
  students: StudentLike[];
  projects: string[];
  capacity: number;
  seed?: number;
}): Assignments {
  const { mode, students, projects, capacity, seed } = params;
  if (mode === "none") {
    const projectsSorted = [...projects].sort((a, b) => a.localeCompare(b));
    return buildEmpty(projectsSorted);
  }
  if (mode === "firstChoiceOnly") {
    return autoAssignFirstChoiceOnly({ students, projects, capacity });
  }
  return autoAssignMinFillGreedyRepair({
    students,
    projects,
    capacity,
    seed,
    minFillRatio: 0.6,
  });
}

