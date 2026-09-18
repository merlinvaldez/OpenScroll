"use client";

import { useId, useState } from "react";
import {
  Activity,
  Archive,
  BookOpen,
  Brain,
  Check,
  Compass,
  Cpu,
  Database,
  Disc,
  Droplets,
  Eye,
  FileText,
  Gem,
  GitBranch,
  Globe,
  Grid,
  History,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Mic,
  Mountain,
  Music,
  Palette,
  Radio,
  Scale,
  Share2,
  Shield,
  Sparkles,
  Sun,
  User,
  Volume2,
  X,
  Zap
} from "lucide-react";
import { Chip, IconButton } from "./primitives";

const ICON_MAP = {
  music: Music,
  history: History,
  compass: Compass,
  languages: BookOpen,
  database: Database,
  globe: Globe,
  sparkles: Sparkles,
  user: User,
  "book-open": BookOpen,
  landmark: MapPin,
  "map-pin": MapPin,
  archive: Archive,
  palette: Palette,
  disc: Disc,
  radio: Radio,
  mic: Mic,
  cpu: Cpu,
  brain: Brain,
  activity: Activity,
  "share-2": Share2,
  layers: Layers,
  zap: Zap,
  gem: Gem,
  droplets: Droplets,
  shield: Shield,
  sun: Sun,
  scale: Scale,
  "file-text": FileText,
  "volume-2": Volume2,
  mountain: Mountain,
  eye: Eye
};

export function TopicMindmap({
  query,
  entity,
  categories = [],
  mindmap = null,
  selectedTopics = new Set(),
  onToggleTopic,
  onSelectAll,
  onClearAll,
  onBuildScroll,
  isLoading = false,
  messages = {}
}) {
  const [viewMode, setViewMode] = useState("mindmap"); // "mindmap" | "clusters"
  const [focusedNode, setFocusedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const infoDialogId = useId();

  const flatTopics = categories.flatMap((category) => category.topics || []);

  function handleBranchToggle(category) {
    const branchTopicNames = category.topics.map((topic) => topic.name);
    const allSelected = branchTopicNames.every((name) => selectedTopics.has(name));

    branchTopicNames.forEach((name) => {
      if (allSelected) {
        if (selectedTopics.has(name)) onToggleTopic(name);
      } else {
        if (!selectedTopics.has(name)) onToggleTopic(name);
      }
    });
  }

  const selectedCount = selectedTopics.size;
  const selectedList = Array.from(selectedTopics);

  return (
    <div className="mindmap-experience" aria-label="Topic Mindmap and Knowledge Graph">
      {/* 1. TOPIC HEADER & VIEW CONTROLS */}
      <header className="mindmap-header">
        <div className="mindmap-title-stack">
          <div className="mindmap-badges">
            <span className="mindmap-pill mindmap-pill--accent">
              <Sparkles className="icon-sm" aria-hidden="true" />
              AI Semantic Graph
            </span>
            <span className="mindmap-pill">
              <Database className="icon-sm" aria-hidden="true" />
              {flatTopics.length} Related Concepts Discovered
            </span>
          </div>
          <h2 className="mindmap-root-title">{entity?.label || query}</h2>
          <p className="mindmap-root-desc" dir="auto">
            {entity?.description || "Select concept nodes to build your customized multimedia stream."}
          </p>
        </div>

        <div className="mindmap-view-switcher" role="tablist" aria-label="View layout">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "mindmap"}
            className={`view-switch-btn ${viewMode === "mindmap" ? "view-switch-btn--active" : ""}`}
            onClick={() => setViewMode("mindmap")}
          >
            <Share2 className="icon-sm" aria-hidden="true" />
            <span>Interactive Mindmap</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "clusters"}
            className={`view-switch-btn ${viewMode === "clusters" ? "view-switch-btn--active" : ""}`}
            onClick={() => setViewMode("clusters")}
          >
            <Grid className="icon-sm" aria-hidden="true" />
            <span>Category Clusters</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN VISUALIZER / GRAPH CANVAS */}
      {viewMode === "mindmap" ? (
        <div className="mindmap-canvas-container" role="region" aria-label="Interactive Mindmap Graph">
          <div className="mindmap-canvas">
            {/* CENTRAL ROOT HUB */}
            <div className="mindmap-root-node">
              <div className="root-node-aura" aria-hidden="true" />
              <div className="root-node-core">
                <Sparkles className="root-node-icon" aria-hidden="true" />
                <strong className="root-node-label">{entity?.label || query}</strong>
                <span className="root-node-badge">Root Curiosity</span>
              </div>
            </div>

            {/* RADIAL CATEGORY CLUSTERS */}
            <div className="mindmap-branches-grid">
              {categories.map((category) => {
                const DimIcon = ICON_MAP[category.icon] || Compass;
                const branchSelectedCount = category.topics.filter((topic) => selectedTopics.has(topic.name)).length;
                const isAllBranchSelected = branchSelectedCount === category.topics.length && category.topics.length > 0;

                return (
                  <div
                    key={category.categoryId}
                    className="mindmap-branch-card"
                    style={{ "--branch-color": category.color || "var(--os-primary)" }}
                  >
                    <div className="branch-card-header">
                      <div className="branch-title-wrap">
                        <span className="branch-icon-badge">
                          <DimIcon className="icon-sm" aria-hidden="true" />
                        </span>
                        <h4>{category.categoryLabel}</h4>
                      </div>
                      <button
                        type="button"
                        className="branch-toggle-btn"
                         onClick={() => handleBranchToggle(category)}
                        title={isAllBranchSelected ? "Deselect Branch" : "Select Entire Branch"}
                      >
                        {isAllBranchSelected ? "Deselect All" : "Select Branch"}
                      </button>
                    </div>

                    <div className="branch-nodes-cluster">
                      {category.topics.map((topic) => {
                        const TopicIcon = ICON_MAP[topic.icon] || DimIcon;
                        const isSelected = selectedTopics.has(topic.name);
                        const isHovered = hoveredNode === topic.name;

                        return (
                          <div
                            key={topic.name}
                            className={`mindmap-node-pill ${isSelected ? "mindmap-node-pill--selected" : ""} ${isHovered ? "mindmap-node-pill--hovered" : ""}`}
                            onMouseEnter={() => setHoveredNode(topic.name)}
                            onMouseLeave={() => setHoveredNode(null)}
                          >
                            <button
                              type="button"
                              className="node-selection-trigger"
                              onClick={() => onToggleTopic(topic.name)}
                              aria-pressed={isSelected}
                            >
                              <span className="node-icon-dot">
                                {isSelected ? (
                                  <Check className="icon-xs" aria-hidden="true" />
                                ) : (
                                  <TopicIcon className="icon-xs" aria-hidden="true" />
                                )}
                              </span>
                              <span className="node-name">{topic.name}</span>
                            </button>

                            <button
                              type="button"
                              className="node-inspect-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFocusedNode(topic);
                              }}
                              aria-label={`Inspect ${topic.name}`}
                              title="Inspect concept summary"
                            >
                              <Info className="icon-xs" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* 3. STRUCTURED CATEGORY LIST VIEW */
         <div className="mindmap-clusters-list">
          {categories.map((category) => {
            const DimIcon = ICON_MAP[category.icon] || Compass;
            return (
              <div key={category.categoryId} className="cluster-group">
                <div className="cluster-group-header">
                  <div className="cluster-title-wrap">
                    <DimIcon className="icon-sm" aria-hidden="true" />
                    <h3>{category.categoryLabel}</h3>
                  </div>
                  <button
                    type="button"
                    className="branch-toggle-btn"
                     onClick={() => handleBranchToggle(category)}
                  >
                    Toggle Category
                  </button>
                </div>
                <div className="cluster-chips-row">
                  {category.topics.map((topic) => {
                    const isSelected = selectedTopics.has(topic.name);
                    const TopicIcon = ICON_MAP[topic.icon] || DimIcon;
                    return (
                      <Chip
                        key={topic.name}
                        selected={isSelected}
                        onClick={() => onToggleTopic(topic.name)}
                      >
                        {isSelected ? (
                          <Check className="check" aria-hidden="true" />
                        ) : (
                          <TopicIcon className="icon-xs" aria-hidden="true" />
                        )}
                        <span>{topic.name}</span>
                      </Chip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. NODE DETAIL DRAWER / MODAL */}
      {focusedNode ? (
        <div className="node-detail-overlay" onClick={() => setFocusedNode(null)}>
          <div
            className="node-detail-card"
            role="dialog"
            aria-labelledby={infoDialogId}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="node-detail-header">
              <div className="node-detail-title-wrap">
                <span className="dimension-badge">{focusedNode.categoryLabel || "Knowledge Category"}</span>
                <h3 id={infoDialogId}>{focusedNode.name}</h3>
              </div>
              <IconButton label="Close" onClick={() => setFocusedNode(null)}>
                <X className="icon-sm" aria-hidden="true" />
              </IconButton>
            </header>
            <p className="node-detail-body">{focusedNode.description || "Key conceptual topic relating to the search domain."}</p>
            <div className="node-detail-actions">
              <button
                type="button"
                className={`node-action-btn ${selectedTopics.has(focusedNode.name) ? "node-action-btn--active" : ""}`}
                onClick={() => {
                  onToggleTopic(focusedNode.name);
                }}
              >
                {selectedTopics.has(focusedNode.name) ? "✓ Included in Feed" : "+ Add to Feed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. STICKY ACTION TRAY (BUILD FEED FROM ACTUAL TOPICS) */}
      <div className="mindmap-sticky-tray">
        <div className="tray-summary">
          <strong className="tray-count">
            {selectedCount} Mindmap {selectedCount === 1 ? "Node" : "Nodes"} Selected
          </strong>
          <span className="tray-preview">
            {selectedCount > 0
              ? selectedList.slice(0, 3).join(" • ") + (selectedCount > 3 ? ` +${selectedCount - 3} more` : "")
              : "Select at least 1 topic to build your feed"}
          </span>
        </div>

        <div className="tray-actions">
          {selectedCount > 0 ? (
            <button type="button" className="tray-clear-btn" onClick={onClearAll}>
              Clear
            </button>
          ) : (
            <button type="button" className="tray-clear-btn" onClick={onSelectAll}>
              Select All
            </button>
          )}

          <button
            type="button"
            className="mindmap-build-cta"
            onClick={onBuildScroll}
            disabled={!selectedCount || isLoading}
          >
            <span>{isLoading ? "Composing Feed..." : "Build Scroll from Mindmap"}</span>
            <Sparkles className="icon-sm" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
