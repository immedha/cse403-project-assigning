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

      // Find Name column (case-insensitive, flexible matching)
      const nameColumn = findColumn(rows[0], ["name", "student name", "student"]);
      if (!nameColumn) {
        setError("Could not find 'Name' column in CSV");
        return;
      }

      // Find Id column (case-insensitive, flexible matching)
      const idColumn = findColumn(rows[0], ["id", "student id", "netid", "net id", "student id"]);
      if (!idColumn) {
        setError("Could not find 'Id' column in CSV");
        return;
      }

      // Find all Choice columns (Choice #1, Choice #2, Choice 1, Choice1, etc.)
      const choiceColumns: { column: string; number: number }[] = [];
      const headers = Object.keys(rows[0]);

      headers.forEach((header) => {
        const lowerHeader = header.toLowerCase().trim();
        // Match patterns like "Choice #1", "Choice 1", "Choice1", "choice #1", etc.
        const match = lowerHeader.match(/choice\s*#?\s*(\d+)/i);
        if (match) {
          const number = parseInt(match[1], 10);
          choiceColumns.push({ column: header, number });
        }
      });

      // Sort by choice number
      choiceColumns.sort((a, b) => a.number - b.number);

      if (choiceColumns.length === 0) {
        setError("Could not find any 'Choice #1', 'Choice #2', etc. columns");
        return;
      }

      // Optional: Assigned Project column (case-insensitive exact match)
      const assignedProjectColumn = findColumn(rows[0], [
        "assigned project",
        "assigned_project",
        "assigned",
      ]);

      // Optional: Team Member columns (Team Member 1/2/..., case-insensitive flexible match)
      const teamMemberColumns: { column: string; number: number }[] = [];
      headers.forEach((header) => {
        const lowerHeader = header.toLowerCase().trim();
        const match = lowerHeader.match(/team\s*member\s*#?\s*(\d+)/i);
        if (match) {
          teamMemberColumns.push({ column: header, number: parseInt(match[1], 10) });
        }
      });
      teamMemberColumns.sort((a, b) => a.number - b.number);

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
              Mutual teammate requests are only enforceable if both students list each other and have identical rankings (enforcement is optional in Settings).
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
