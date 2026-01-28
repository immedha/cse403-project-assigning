import { useState, useRef, useCallback, useEffect } from "react";
import { FolderKanban, BarChart3, Users } from "lucide-react";
import "./FlexiblePanelLayout.css";

export type PanelId = "students" | "projects" | "analysis";

export interface Panel {
  id: PanelId;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface SlotContent {
  tabs: PanelId[];
  activeTab: PanelId | null;
}

interface GridLayout {
  leftTop: SlotContent;
  leftBottom: SlotContent;
  rightTop: SlotContent;
  rightBottom: SlotContent;
}

interface FlexiblePanelLayoutProps {
  panels: Panel[];
}

const panelIcons: Record<PanelId, React.ReactNode> = {
  students: <Users size={14} />,
  projects: <FolderKanban size={14} />,
  analysis: <BarChart3 size={14} />,
};

export default function FlexiblePanelLayout({ panels }: FlexiblePanelLayoutProps) {
  const [layout, setLayout] = useState<GridLayout>({
    leftTop: { tabs: ["students"], activeTab: "students" },
    leftBottom: { tabs: ["projects"], activeTab: "projects" },
    rightTop: { tabs: ["analysis"], activeTab: "analysis" },
    rightBottom: { tabs: [], activeTab: null },
  });

  const [leftWidth, setLeftWidth] = useState(50);
  const [topHeight, setTopHeight] = useState(50);
  const [draggedTab, setDraggedTab] = useState<PanelId | null>(null);
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const getPanelById = (id: PanelId | null) => {
    if (!id) return null;
    return panels.find((p) => p.id === id);
  };

  const handleTabDragStart = (panelId: PanelId) => {
    setDraggedTab(panelId);
  };

  const handleTabDragEnd = () => {
    setDraggedTab(null);
  };

  const handleGridDrop = (targetSlot: keyof GridLayout) => {
    if (!draggedTab) return;

    setLayout((prev) => {
      const newLayout = { ...prev };

      // Check if bottom slot is being used without top slot
      if (targetSlot === "leftBottom" && newLayout.leftTop.tabs.length === 0) {
        return prev; // Can't use bottom without top
      }
      if (targetSlot === "rightBottom" && newLayout.rightTop.tabs.length === 0) {
        return prev; // Can't use bottom without top
      }

      // Find where the dragged tab currently is
      let sourceSlot: keyof GridLayout | null = null;
      if (newLayout.leftTop.tabs.includes(draggedTab)) sourceSlot = "leftTop";
      else if (newLayout.leftBottom.tabs.includes(draggedTab)) sourceSlot = "leftBottom";
      else if (newLayout.rightTop.tabs.includes(draggedTab)) sourceSlot = "rightTop";
      else if (newLayout.rightBottom.tabs.includes(draggedTab)) sourceSlot = "rightBottom";

      // Check if target slot already has this tab (prevent duplicates)
      const targetSlotContent = newLayout[targetSlot];
      if (targetSlotContent.tabs.includes(draggedTab)) {
        return prev;
      }

      // Determine which panel the target is in
      const isLeftPanel = targetSlot === "leftTop" || targetSlot === "leftBottom";
      const isRightPanel = targetSlot === "rightTop" || targetSlot === "rightBottom";
      const isSourceLeftPanel = sourceSlot === "leftTop" || sourceSlot === "leftBottom";
      const isSourceRightPanel = sourceSlot === "rightTop" || sourceSlot === "rightBottom";

      // Count tabs in the target panel BEFORE removing the dragged tab
      // If moving within the same panel, the tab is already counted, so we don't need to add it
      // If moving from a different panel, we need to check if there's room
      let targetPanelTabCount = 0;
      if (isLeftPanel) {
        targetPanelTabCount = newLayout.leftTop.tabs.length + newLayout.leftBottom.tabs.length;
        // If moving within the same panel, the tab is already counted, so subtract 1
        if (isSourceLeftPanel && sourceSlot) {
          targetPanelTabCount -= 1;
        }
      } else if (isRightPanel) {
        targetPanelTabCount = newLayout.rightTop.tabs.length + newLayout.rightBottom.tabs.length;
        // If moving within the same panel, the tab is already counted, so subtract 1
        if (isSourceRightPanel && sourceSlot) {
          targetPanelTabCount -= 1;
        }
      }

      // Allow up to 3 tabs per panel - if already at max (and not moving within same panel), don't add
      if (targetPanelTabCount >= 3) {
        return prev;
      }

      // Now remove the tab from its source location
      if (sourceSlot) {
        const sourceSlotContent = newLayout[sourceSlot];
        const index = sourceSlotContent.tabs.indexOf(draggedTab);
        if (index !== -1) {
          sourceSlotContent.tabs.splice(index, 1);
          if (sourceSlotContent.activeTab === draggedTab) {
            sourceSlotContent.activeTab = sourceSlotContent.tabs.length > 0 ? sourceSlotContent.tabs[0] : null;
          }
        }
      }

      // Add dragged tab to target slot
      targetSlotContent.tabs.push(draggedTab);
      targetSlotContent.activeTab = draggedTab;

      // Ensure at least one tab per side
      const leftHasTabs = newLayout.leftTop.tabs.length > 0 || newLayout.leftBottom.tabs.length > 0;
      const rightHasTabs = newLayout.rightTop.tabs.length > 0 || newLayout.rightBottom.tabs.length > 0;

      if (!leftHasTabs && rightHasTabs) {
        // Move a tab from right to left
        const rightSlot = newLayout.rightBottom.tabs.length > 0 ? "rightBottom" : "rightTop";
        const tabToMove = newLayout[rightSlot].tabs[0];
        if (tabToMove) {
          newLayout.leftTop.tabs = [tabToMove];
          newLayout.leftTop.activeTab = tabToMove;
          newLayout[rightSlot].tabs = [];
          newLayout[rightSlot].activeTab = null;
        }
      }

      if (!rightHasTabs && leftHasTabs) {
        // Move a tab from left to right
        const leftSlot = newLayout.leftBottom.tabs.length > 0 ? "leftBottom" : "leftTop";
        const tabToMove = newLayout[leftSlot].tabs[0];
        if (tabToMove) {
          newLayout.rightTop.tabs = [tabToMove];
          newLayout.rightTop.activeTab = tabToMove;
          newLayout[leftSlot].tabs = [];
          newLayout[leftSlot].activeTab = null;
        }
      }

      return newLayout;
    });

    setDraggedTab(null);
  };

  const handleTabClick = (slot: keyof GridLayout, tabId: PanelId) => {
    setLayout((prev) => {
      const newLayout = { ...prev };
      newLayout[slot].activeTab = tabId;
      return newLayout;
    });
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

  const renderTabHeader = (slot: keyof GridLayout) => {
    const slotContent = layout[slot];
    const hasTabs = slotContent.tabs.length > 0;
    const isDragging = draggedTab !== null;

    return (
      <div
        className={`grid-slot-header ${hasTabs ? "occupied" : "empty"} ${isDragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("drag-over");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("drag-over");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drag-over");
          handleGridDrop(slot);
        }}
      >
        {hasTabs ? (
          <div className="tab-buttons">
            {slotContent.tabs.map((tabId) => {
              const panel = getPanelById(tabId);
              if (!panel) return null;
              const isActive = slotContent.activeTab === tabId;
              const isDraggingThis = draggedTab === tabId;
              const icon = panel.icon || panelIcons[tabId];

              return (
                <div
                  key={tabId}
                  className={`tab-button ${isActive ? "active" : ""} ${isDraggingThis ? "dragging" : ""}`}
                  onClick={() => handleTabClick(slot, tabId)}
                  draggable
                  onDragStart={() => handleTabDragStart(tabId)}
                  onDragEnd={handleTabDragEnd}
                >
                  {icon && <span className="tab-icon">{icon}</span>}
                  <span className="tab-label">{panel.title}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-slot-hint">Drop tab here</div>
        )}
      </div>
    );
  };

  const leftTopPanel = getPanelById(layout.leftTop.activeTab);
  const leftBottomPanel = getPanelById(layout.leftBottom.activeTab);
  const rightTopPanel = getPanelById(layout.rightTop.activeTab);
  const rightBottomPanel = getPanelById(layout.rightBottom.activeTab);

  return (
    <div className="flexible-panel-layout" ref={containerRef}>
      {/* Left Panel */}
      <div className="left-panel" ref={leftPanelRef} style={{ width: `${leftWidth}%` }}>
        {/* Top Slot */}
        <div className="panel-section" style={{ height: `${topHeight}%` }}>
          <div className="panel-header">
            {renderTabHeader("leftTop")}
          </div>
          <div className="panel-content">
            {leftTopPanel?.content || <div className="empty-state">No tab assigned</div>}
          </div>
        </div>

        {/* Vertical Divider */}
        <div
          className={`divider vertical-divider ${isDraggingVertical ? "dragging" : ""}`}
          onMouseDown={handleVerticalMouseDown}
        >
          <div className="divider-handle" />
        </div>

        {/* Bottom Slot */}
        <div className="panel-section" style={{ height: `${100 - topHeight}%` }}>
          <div className="panel-header">
            {renderTabHeader("leftBottom")}
          </div>
          <div className="panel-content">
            {leftBottomPanel?.content || <div className="empty-state">No tab assigned</div>}
          </div>
        </div>
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
        {/* Top Slot */}
        <div className="panel-section" style={{ height: `${topHeight}%` }}>
          <div className="panel-header">
            {renderTabHeader("rightTop")}
          </div>
          <div className="panel-content">
            {rightTopPanel?.content || <div className="empty-state">No tab assigned</div>}
          </div>
        </div>

        {/* Vertical Divider */}
        <div
          className={`divider vertical-divider ${isDraggingVertical ? "dragging" : ""}`}
          onMouseDown={handleVerticalMouseDown}
        >
          <div className="divider-handle" />
        </div>

        {/* Bottom Slot */}
        <div className="panel-section" style={{ height: `${100 - topHeight}%` }}>
          <div className="panel-header">
            {renderTabHeader("rightBottom")}
          </div>
          <div className="panel-content">
            {rightBottomPanel?.content || <div className="empty-state">No tab assigned</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
