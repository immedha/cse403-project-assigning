# GroupMatch

A web application for assigning students to project groups with drag-and-drop, satisfaction-aware auto-fill algorithms, and rich analysis.

## Features

- **CSV Import**:
  - Flexible columns: detects `Name`, `Id`, and any `Choice 1`, `Choice 2`, … columns (case-insensitive).
  - Optional `Assigned Project` column to preload an existing matching.
- **Auto-fill algorithms** (configurable in Settings):
  - **Simple (default)**: assign each student to their 1st choice if capacity allows.
  - **Greedy + repair (min-fill)**: chooses a subset of projects, seeds each used project to ≥60% of max size, then improves total preference satisfaction with quick swaps.
  - **No auto-fill**: start with everyone unassigned.
- **Drag & Drop assignment**:
  - Unassigned students pane with search, preference badges, and counts.
  - Project cards with drag-and-drop students, capacity indicators, and right-click preference tooltips.
- **Project analysis**:
  - Choice-rank table with interactive rank filters and detailed tooltips (including “Add all” to a project).
  - Compact satisfaction stats (percent getting 1st / 2nd / 3rd+ choices).
- **Round-trip export**:
  - Export to XLSX with columns `Assigned Project, Name, Id, Choice 1, Choice 2, …`.
  - The exported file can be re-imported as CSV (after saving as CSV) to reproduce the same state.
- **Persistence**:
  - All page state (students, projects, assignments, search, settings) is auto-saved to `localStorage`.
  - “Clear saved data” button in Settings resets the app in this browser.

## CSV Format

The application expects a header row and at least these columns (names are matched case-insensitively):

- **Required**
  - `Name` – student name (or equivalent like `Student Name`)
  - `Id` – unique student identifier (NetID, SID, etc.)
  - One or more `Choice N` columns (`Choice 1`, `Choice 2`, `Choice #3`, `choice1`, …).

- **Optional**
  - `Assigned Project` – if present, students are initially assigned to the given project names.

All distinct project names appearing in any `Choice` column or in `Assigned Project` are treated as projects in the app.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port Vite assigns).

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Upload CSV**: Use the upload button in the header to load students, preferences, and (optionally) existing assignments.
2. **Auto-fill (optional)**: Choose an auto-fill algorithm in Settings and re-upload, or keep “No auto-fill” and assign manually.
3. **Assign projects**:
   - Drag students from the Unassigned Students pane into project cards.
   - Drag between projects to move students; use the × button to unassign.
4. **Search & inspect**:
   - Search students by name/ID; assigned students still show (grayed out) when searching.
   - Right-click a student in a project to see their full preference list.
5. **Analyze**:
   - Use the Project Analysis pane to see choice counts per project and satisfaction stats.
   - Use the rank tabs to focus on 1st, 2nd, 3rd, … choices.
6. **Export / share**:
   - Click the Export button in the header to download an XLSX with `Assigned Project, Name, Id, Choice 1..N`.
   - This file can be saved as CSV and re-used as input.

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **PapaParse** - CSV parsing
- **CSS3** - Styling with modern design

## Project Structure (high level)

```
src/
  ├── main.tsx                 # App entry (mounts MainApp)
  ├── App.tsx                  # Main application component
  ├── index.css                # Global resets and typography
  ├── components/
  │   ├── CSVUpload.tsx        # CSV uploader
  │   ├── StudentsPane.tsx     # Unassigned students list & search
  │   ├── ProjectsPane.tsx     # Project cards and assignments
  │   ├── AnalysisPane.tsx     # Analysis table & satisfaction stats
  │   ├── Tooltip.tsx          # Shared tooltip component
  │   └── Layout/
  │       ├── SimpleToggleLayout.tsx # Panel/tabs layout
  │       └── MainApp.css            # Main layout styles
  └── utils/
      ├── autoAssign.ts        # Auto-fill algorithms
      └── exportXlsx.ts        # XLSX round-trip export helper

## Features in Detail

### Left Panel
- **Unassigned Students**: List of students not yet assigned to any project
- **Project Groups**: Grid of project boxes where students can be assigned
  - Each box shows project name and current count (e.g., "3/6")
  - Boxes turn red when full (6 students)
  - Drag and drop enabled for easy assignment

### Right Panel
- **Project Analysis Table**: Comprehensive statistics showing:
  - Project names
  - Count of 1st, 2nd, 3rd, 4th, and 5th choices
  - Total choice count
  - Visual highlighting for most popular and unwanted projects
- **Summary Cards**:
  - Most Popular Project (by first choice count)
  - Unwanted Projects (projects with zero total choices)

## License

Private project
