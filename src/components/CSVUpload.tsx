import { useState, useRef } from "react";
import Papa from "papaparse";
import { HelpCircle } from "lucide-react";
import "./CSVUpload.css";

interface CSVUploadProps {
  onUpload: (data: {
    students: Array<{
      id: string;
      name: string;
      choices: string[];
      teammateIds?: string[];
    }>;
    projects: string[];
    projectAssignments?: Record<string, string[]>;
  }) => void;
}

export default function CSVUpload({ onUpload }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);

  const normalizeHeader = (h: string) => h.toLowerCase().replace(/\s+/g, " ").trim();

  const extractFirstNumber = (h: string): number | null => {
    const m = h.match(/(\d+)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  type HeaderKind = "team_member" | "choice" | "id" | "name" | "other";
  const classifyHeader = (header: string): { kind: HeaderKind; number: number | null } => {
    const norm = normalizeHeader(header);
    const number = extractFirstNumber(norm);

    const hasTeamWord = /\bteam\b/i.test(norm);
    const hasMemberWord = /\bmember\b/i.test(norm);
    const hasChoiceWord = /\bchoice\b/i.test(norm);
    const hasNameWord = /\bname\b/i.test(norm) || norm.includes("name");
    const hasNetId = /net\s*id/i.test(norm) || /\bnetid\b/i.test(norm);
    const hasIdWord = /\bid\b/i.test(norm) || norm === "id";

    // Priority order (to avoid confusion):
    // 1) team member + number (covers "Team Member #1 Netid" and "Team Member #1 Choice")
    // 2) choice + number (covers "First (1) choice", "Choice #1", etc.)
    // 3) netid/id (but only if not a team-member/choice column)
    // 4) name (but only if not a team-member/choice/id column)
    if (hasTeamWord && hasMemberWord && number != null) return { kind: "team_member", number };
    if (hasChoiceWord && number != null) return { kind: "choice", number };
    if ((hasNetId || hasIdWord) && !(hasTeamWord && hasMemberWord) && !hasChoiceWord) {
      return { kind: "id", number: null };
    }
    if (hasNameWord && !(hasTeamWord && hasMemberWord) && !hasChoiceWord && !hasNetId && !hasIdWord) {
      return { kind: "name", number: null };
    }
    return { kind: "other", number: null };
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csvText: string) => {
    try {
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      const rows = parsed.data as any[];

      if (rows.length === 0) {
        setError("CSV file is empty");
        return;
      }

      const headers = Object.keys(rows[0]);
      const classified = headers.map((h) => ({ header: h, ...classifyHeader(h) }));

      // Find Name column: classified as name
      const nameColumn = classified.find((x) => x.kind === "name")?.header ?? null;
      if (!nameColumn) {
        setError("Could not find 'Name' column in CSV");
        return;
      }

      // Find Id column: classified as id (netid/id), but never a team-member/choice column
      const idColumn = classified.find((x) => x.kind === "id")?.header ?? null;
      if (!idColumn) {
        setError("Could not find 'Id' column in CSV");
        return;
      }

      // Find all Choice columns: contains "choice" and a number anywhere
      const choiceColumns: { column: string; number: number }[] = [];
      classified.forEach((x) => {
        if (x.kind !== "choice" || x.number == null) return;
        choiceColumns.push({ column: x.header, number: x.number });
      });

      // Sort by choice number
      choiceColumns.sort((a, b) => a.number - b.number);

      if (choiceColumns.length === 0) {
        setError("Could not find any 'Choice #1', 'Choice #2', etc. columns");
        return;
      }

      // Optional: Team Member columns: contains both "team" and "member" and a number anywhere
      const teamMemberColumns: { column: string; number: number }[] = [];
      classified.forEach((x) => {
        if (x.kind !== "team_member" || x.number == null) return;
        teamMemberColumns.push({ column: x.header, number: x.number });
      });
      teamMemberColumns.sort((a, b) => a.number - b.number);

      // Optional: Assigned Project column (detected LAST to avoid confusion with other fields)
      const used = new Set<string>([
        nameColumn,
        idColumn,
        ...choiceColumns.map((c) => c.column),
        ...teamMemberColumns.map((c) => c.column),
      ]);
      const assignedProjectColumn =
        headers.find((h) => {
          if (used.has(h)) return false;
          const norm = normalizeHeader(h);
          const hasAssigned = /\bassigned\b/i.test(norm);
          const hasProject = /\bproject\b/i.test(norm);
          return hasAssigned && hasProject;
        }) ??
        headers.find((h) => {
          if (used.has(h)) return false;
          const norm = normalizeHeader(h);
          return /\bassigned\b/i.test(norm);
        }) ??
        // Backward-compatible exact matches
        findColumn(rows[0], ["assigned project", "assigned_project", "assigned"]);

      // Parse students
      const students = rows.map((row, idx) => {
        const choices = choiceColumns
          .map(({ column }) => row[column])
          .filter((choice) => choice && String(choice).trim() !== "")
          .map((choice) => String(choice).trim());

        const id = String(row[idColumn] || idx);
        const teammateIdsRaw = teamMemberColumns
          .map(({ column }) => row[column])
          .filter((v) => v && String(v).trim() !== "")
          .map((v) => String(v).trim())
          .filter((tId) => tId !== id);
        // Treat teammate columns as an unordered set: dedupe + sort so column order never matters.
        const teammateIds = Array.from(new Set(teammateIdsRaw)).sort((a, b) => a.localeCompare(b));

        return {
          id,
          name: String(row[nameColumn] || "Unknown").trim(),
          choices,
          teammateIds: teammateIds.length ? teammateIds : undefined,
        };
      });

      // Extract all unique projects from choices (+ optional assigned project)
      const projectsSet = new Set<string>();
      students.forEach((s) => {
        s.choices.forEach((choice) => projectsSet.add(choice));
      });

      const initialAssignments: Record<string, string[]> = {};
      if (assignedProjectColumn) {
        rows.forEach((row, idx) => {
          const id = String(row[idColumn] || idx);
          const rawAssigned = row[assignedProjectColumn];
          const assigned = rawAssigned ? String(rawAssigned).trim() : "";
          if (!assigned) return;
          projectsSet.add(assigned);
          if (!initialAssignments[assigned]) initialAssignments[assigned] = [];
          initialAssignments[assigned].push(id);
        });
      }

      onUpload({
        students,
        projects: Array.from(projectsSet),
        projectAssignments: assignedProjectColumn ? initialAssignments : undefined,
      });

      setError(null);
    } catch (err) {
      setError(`Error parsing CSV: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const findColumn = (row: any, possibleNames: string[]): string | null => {
    const headers = Object.keys(row);
    for (const name of possibleNames) {
      const found = headers.find(
        (h) => h.toLowerCase().trim() === name.toLowerCase()
      );
      if (found) return found;
    }
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow selecting the same file repeatedly (otherwise onChange may not fire).
    e.target.value = "";
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="csv-upload-container">
      <div
        className={`csv-upload-button ${isDragging ? "dragging" : ""} ${error ? "error" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          // Ensure re-selecting the same file triggers onChange.
          if (fileInputRef.current) fileInputRef.current.value = "";
          fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
        <span className="upload-icon">📄</span>
        <span className="upload-label">
          Upload CSV
        </span>
        <button
          ref={infoRef}
          type="button"
          className="upload-info-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoTooltip(!showInfoTooltip);
          }}
          onBlur={() => setTimeout(() => setShowInfoTooltip(false), 150)}
          title="CSV format help"
        >
          <HelpCircle size={14} />
        </button>
      </div>
      {showInfoTooltip && (
        <div className="upload-info-tooltip">
          <div className="upload-info-title">CSV Format</div>
          <div className="upload-info-content">
            <div><strong>Required Columns:</strong> Name, Id, Choice 1, Choice 2, ...</div>
            <div><strong>Optional Column:</strong> Assigned Project (does initial project assignments, skips auto-fill algorithm)</div>
            <div><strong>Optional Columns:</strong> Team Member 1, Team Member 2, ... (IDs of requested teammates)</div>
            <div className="upload-info-note">
              Mutual teammate requests are only enforceable if ALL students list each other and have identical rankings.
            </div>
            <div className="upload-info-note">Columns can be in any order</div>
            <div className="upload-info-example">
              <div>Example:</div>
              <pre>Name,Id,Choice 1,Choice 2,Team Member 1,Assigned Project<br/>
Alice,alice123,Project A,Project B,bob456,<br/>
Bob,bob456,Project A,Project B,alice123,Project A</pre>
            </div>
          </div>
        </div>
      )}
      {error && <div className="upload-error-inline">{error}</div>}
    </div>
  );
}
