"use client";

import { Bookmark, Compass, Layers, Search, Settings, SlidersHorizontal } from "lucide-react";
import { IconButton } from "./primitives";

export function AppShell({
  activeNav = "explore",
  feedMode = false,
  messages,
  onScrolls,
  onExplore,
  onSaved,
  onSettings,
  onBrandClick,
  children
}) {
  return (
    <div className={`app-shell ${feedMode ? "app-shell--feed" : ""}`}>
      <div className="app-region">
        {!feedMode ? (
          <header className="brand-header">
            <button
              type="button"
              className="brand-btn"
              onClick={onBrandClick || onExplore}
              aria-label="OpenScroll Home"
            >
              <span className="brand" aria-hidden="true">O</span>
              <span className="brand-title">OpenScroll</span>
            </button>
          </header>
        ) : null}

        <div className="content-region">{children}</div>

        {!feedMode ? (
          <nav className="bottom-nav" aria-label={messages.navigation}>
            <IconButton
              aria-current={activeNav === "scrolls" ? "page" : undefined}
              label={messages.scrollsNav}
              onClick={onScrolls}
              className="nav-btn"
            >
              <Layers aria-hidden="true" />
              <span className="nav-label">{messages.scrollsNav}</span>
            </IconButton>

            <IconButton
              aria-current={activeNav === "explore" ? "page" : undefined}
              label={messages.exploreNav}
              onClick={onExplore}
              className="nav-btn"
            >
              <Compass aria-hidden="true" />
              <span className="nav-label">{messages.exploreNav}</span>
            </IconButton>

            <IconButton
              aria-current={activeNav === "saved" ? "page" : undefined}
              label={messages.savedNav}
              onClick={onSaved}
              className="nav-btn"
            >
              <Bookmark aria-hidden="true" />
              <span className="nav-label">{messages.savedNav}</span>
            </IconButton>

            <IconButton
              aria-current={activeNav === "settings" ? "page" : undefined}
              label={messages.settings}
              onClick={onSettings}
              className="nav-btn"
            >
              <SlidersHorizontal aria-hidden="true" />
              <span className="nav-label">{messages.settings}</span>
            </IconButton>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export default AppShell;
