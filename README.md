# Group Maker

A web application for managing student project assignments with drag-and-drop functionality and comprehensive data analysis.

## Features

- **CSV Import**: Upload CSV files containing student information and project preferences
- **Drag & Drop Assignment**: Easily assign students to projects by dragging them into project boxes
- **Project Management**: Organize students into project groups with a maximum of 6 students per project
- **Data Analysis**: 
  - View project popularity statistics (1st, 2nd, 3rd, 4th, 5th choice counts)
  - Identify most popular projects
  - Find projects with no student interest
  - See total choice counts per project

## CSV Format

The application expects a CSV file with the following columns:
- `Name` - Student's name
- `Email Address` - Student's email
- `Your UW NetId` - Student's NetID
- `First (1) Choice` - First project preference
- `Second (2)  Choice` - Second project preference
- `Third (3) Choice` - Third project preference
- `Fourth (4) Choice` - Fourth project preference
- `Fifth (5) Choice` - Fifth project preference

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

1. **Upload CSV**: Click the file input in the header to upload a CSV file with student data
2. **View Students**: Unassigned students appear in the left panel with their preferences
3. **Assign Projects**: Drag students from the unassigned list and drop them into project boxes
4. **Analyze Data**: View comprehensive statistics in the right panel:
   - See which projects are most popular (highlighted in green)
   - Identify projects with no interest (highlighted in red)
   - Review choice distribution across all preference ranks
5. **Manage Groups**: Remove students from projects using the × button

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **PapaParse** - CSV parsing
- **CSS3** - Styling with modern design

## Project Structure

```
src/
  ├── App.tsx       # Main application component
  ├── App.css       # Application styles
  ├── index.css     # Global styles
  └── main.tsx      # Application entry point
```

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
