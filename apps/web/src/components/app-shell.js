"use client";

export function AppShell({
  feedMode = false,
  onExplore,
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
      </div>
    </div>
  );
}

export default AppShell;
