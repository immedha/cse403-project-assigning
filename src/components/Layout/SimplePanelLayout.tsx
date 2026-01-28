import { useState, useRef, useCallback, useEffect } from "react";
import "./SimplePanelLayout.css";

export type PanelId = "students" | "projects" | "analysis";

export interface Panel {
  id: PanelId;
  title: string;
  content: React.ReactNode;
}

interface SimplePanelLayoutProps {
  panels: Panel[];
}

export default function SimplePanelLayout({ panels }: SimplePanelLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [topHeight, setTopHeight] = useState(50); // Percentage of left panel
  
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const horizontalDividerRef = useRef<HTMLDivElement>(null);
  const verticalDividerRef = useRef<HTMLDivElement>(null);

  const getPanelById = (id: PanelId) => panels.find((p) => p.id === id);

  // Horizontal divider (between left and right panels)
  const handleHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHorizontal(true);
  }, []);

  // Vertical divider (between top and bottom in left panel)
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
        // Constrain between 20% and 80%
        const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
        setLeftWidth(constrainedWidth);
      }

      if (isDraggingVertical && leftPanelRef.current) {
        const leftPanelRect = leftPanelRef.current.getBoundingClientRect();
        const leftPanelHeight = leftPanelRect.height;
        const newTopHeight = ((e.clientY - leftPanelRect.top) / leftPanelHeight) * 100;
        // Constrain between 20% and 80%
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
    <div className="simple-panel-layout" ref={containerRef}>
      {/* Left Panel */}
      <div className="left-panel" ref={leftPanelRef} style={{ width: `${leftWidth}%` }}>
        {/* Top Tab - Unassigned Students */}
        <div className="panel-section" style={{ height: `${topHeight}%` }}>
          <div className="panel-header">
            <h3>{studentsPanel?.title || "Unassigned Students"}</h3>
          </div>
          <div className="panel-content">
            {studentsPanel?.content || <div>Students content</div>}
          </div>
        </div>

        {/* Vertical Divider */}
        <div
          ref={verticalDividerRef}
          className={`divider vertical-divider ${isDraggingVertical ? "dragging" : ""}`}
          onMouseDown={handleVerticalMouseDown}
        >
          <div className="divider-handle" />
        </div>

        {/* Bottom Tab - Projects */}
        <div className="panel-section" style={{ height: `${100 - topHeight}%` }}>
          <div className="panel-header">
            <h3>{projectsPanel?.title || "Projects"}</h3>
          </div>
          <div className="panel-content">
            {projectsPanel?.content || <div>Projects content</div>}
          </div>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div
        ref={horizontalDividerRef}
        className={`divider horizontal-divider ${isDraggingHorizontal ? "dragging" : ""}`}
        onMouseDown={handleHorizontalMouseDown}
      >
        <div className="divider-handle" />
      </div>

      {/* Right Panel */}
      <div className="right-panel" style={{ width: `${100 - leftWidth}%` }}>
        <div className="panel-section" style={{ height: "100%" }}>
          <div className="panel-header">
            <h3>{analysisPanel?.title || "Project Analysis"}</h3>
          </div>
          <div className="panel-content">
            {analysisPanel?.content || <div>Analysis content</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
