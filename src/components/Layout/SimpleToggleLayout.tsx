import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import "./SimpleToggleLayout.css";

export type PanelId = "students" | "projects" | "analysis";

export interface Panel {
  id: PanelId;
  title: string;
  content: React.ReactNode;
  titleSuffix?: React.ReactNode;
  headerContent?: React.ReactNode;
}

interface SimpleToggleLayoutProps {
  panels: Panel[];
}

export default function SimpleToggleLayout({ panels }: SimpleToggleLayoutProps) {
  const [projectsInRight, setProjectsInRight] = useState(false);
  const [rightActiveTab, setRightActiveTab] = useState<"projects" | "analysis">("analysis");
  const [leftWidth, setLeftWidth] = useState(50);
  const [topHeight, setTopHeight] = useState(50);
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const getPanelById = (id: PanelId) => panels.find((p) => p.id === id);

  const toggleProjectsPosition = () => {
    setProjectsInRight(!projectsInRight);
    // When moving Projects to right, switch to Projects tab
    if (!projectsInRight) {
      setRightActiveTab("projects");
    }
  };

  const handleHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHorizontal(true);
  }, []);

  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isDraggingHorizontal) {
        const newLeftWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
        const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
        setLeftWidth(constrainedWidth);
      }

      if (isDraggingVertical && leftPanelRef.current) {
        const leftPanelRect = leftPanelRef.current.getBoundingClientRect();
        const leftPanelHeight = leftPanelRect.height;
        const newTopHeight = ((e.clientY - leftPanelRect.top) / leftPanelHeight) * 100;
        const constrainedHeight = Math.max(20, Math.min(80, newTopHeight));
        setTopHeight(constrainedHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingHorizontal(false);
      setIsDraggingVertical(false);
    };

    if (isDraggingHorizontal || isDraggingVertical) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isDraggingHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingHorizontal, isDraggingVertical]);

  const studentsPanel = getPanelById("students");
  const projectsPanel = getPanelById("projects");
  const analysisPanel = getPanelById("analysis");

  return (
    <div className="simple-toggle-layout" ref={containerRef}>
      {/* Left Panel */}
      <div className="left-panel" ref={leftPanelRef} style={{ width: `${leftWidth}%` }}>
        {/* Top Tab - Students */}
        <div className="panel-section" style={{ height: projectsInRight ? "100%" : `${topHeight}%` }}>
          <div className="panel-header">
            <h3>
              {studentsPanel?.title || "Unassigned Students"}
              {studentsPanel?.titleSuffix && <span className="header-suffix">{studentsPanel.titleSuffix}</span>}
            </h3>
            {studentsPanel?.headerContent && <div className="header-content">{studentsPanel.headerContent}</div>}
          </div>
          <div className="panel-content">
            {studentsPanel?.content || <div className="empty-state">No content</div>}
          </div>
        </div>

        {/* Vertical Divider */}
        {!projectsInRight && (
          <>
            <div
              className={`divider vertical-divider ${isDraggingVertical ? "dragging" : ""}`}
              onMouseDown={handleVerticalMouseDown}
            >
              <div className="divider-handle" />
            </div>

            {/* Bottom Tab - Projects */}
            <div className="panel-section" style={{ height: `${100 - topHeight}%` }}>
              <div className="panel-header">
                <div className="header-with-toggle">
                  <h3>{projectsPanel?.title || "Projects"}</h3>
                  {projectsPanel?.headerContent && <div className="header-content">{projectsPanel.headerContent}</div>}
                  <button
                    className="toggle-projects-btn"
                    onClick={toggleProjectsPosition}
                    title="Move Projects to right panel"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="panel-content">
                {projectsPanel?.content || <div className="empty-state">No content</div>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Horizontal Divider */}
      <div
        className={`divider horizontal-divider ${isDraggingHorizontal ? "dragging" : ""}`}
        onMouseDown={handleHorizontalMouseDown}
      >
        <div className="divider-handle" />
      </div>

      {/* Right Panel */}
      <div className="right-panel" style={{ width: `${100 - leftWidth}%` }}>
        <div className="panel-section" style={{ height: "100%" }}>
          {projectsInRight ? (
            // Tab buttons for Projects and Analysis
            <>
              <div className="panel-header">
                <div className="tab-buttons-container">
                  <button
                    className={`tab-button ${rightActiveTab === "projects" ? "active" : ""}`}
                    onClick={() => setRightActiveTab("projects")}
                  >
                    {projectsPanel?.title || "Projects"}
                  </button>
                  <button
                    className={`tab-button ${rightActiveTab === "analysis" ? "active" : ""}`}
                    onClick={() => setRightActiveTab("analysis")}
                  >
                    {analysisPanel?.title || "Project Analysis"}
                  </button>
                  {rightActiveTab === "projects" && projectsPanel?.headerContent && (
                    <div className="header-content">{projectsPanel.headerContent}</div>
                  )}
                  <button
                    className="toggle-projects-btn"
                    onClick={toggleProjectsPosition}
                    title="Move Projects back to left panel"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
              </div>
              <div className="panel-content">
                {rightActiveTab === "projects" && (projectsPanel?.content || <div className="empty-state">No content</div>)}
                {rightActiveTab === "analysis" && (analysisPanel?.content || <div className="empty-state">No content</div>)}
              </div>
            </>
          ) : (
            // Just Analysis
            <>
              <div className="panel-header">
                <h3>{analysisPanel?.title || "Project Analysis"}</h3>
              </div>
              <div className="panel-content">
                {analysisPanel?.content || <div className="empty-state">No content</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
