import { useEffect, useState, useRef } from "react";
import "./AnalysisPane.css";

interface TooltipProps {
  element: HTMLElement;
  students: string[];
  project: string;
  onAddAll?: (project: string, studentNames: string[]) => void;
  onClose?: () => void;
}

export default function Tooltip({
  element,
  students,
  project,
  onAddAll,
  onClose,
}: TooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPositioned(false);
    const updatePosition = () => {
      if (!element || !tooltipRef.current) return;

      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      const gap = 6;
      const margin = 8;

      // Prefer above; if it would go off-screen, place below.
      const topAbove = rect.top - tooltipRect.height - gap;
      const topBelow = rect.bottom + gap;
      const top =
        topAbove >= margin
          ? topAbove
          : Math.min(
              topBelow,
              Math.max(margin, window.innerHeight - tooltipRect.height - margin)
            );

      // Center horizontally, but clamp within viewport.
      const idealLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
      const left = Math.min(
        window.innerWidth - tooltipRect.width - margin,
        Math.max(margin, idealLeft)
      );

      setPosition({ top, left });
      setIsPositioned(true);
    };

    // Use requestAnimationFrame to ensure tooltip is rendered before positioning
    requestAnimationFrame(() => {
      updatePosition();
    });
    
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [element]);

  const handleAddAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddAll && students.length > 0) {
      onAddAll(project, students);
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div
      ref={tooltipRef}
      className="tooltip tooltip-fixed"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        visibility: isPositioned ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tooltip-content">
        {students.length > 0 ? students.join(", ") : "None"}
      </div>
      <div className="tooltip-actions">
        {students.length > 0 && onAddAll && (
          <button className="tooltip-add-all-btn" onClick={handleAddAll}>
            Add All
          </button>
        )}
      </div>
    </div>
  );
}
