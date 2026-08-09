import { Bookmark, Compass, Layers3, SlidersHorizontal } from "lucide-react";

const navItems = [
  { label: "Scrolls", icon: Layers3 },
  { label: "Explore", icon: Compass },
  { label: "Saved", icon: Bookmark },
  { label: "Settings", icon: SlidersHorizontal }
];

function Navigation({ compact = false }) {
  return (
    <nav className={compact ? "bottom-navigation" : "side-navigation"} aria-label="Primary navigation">
      {navItems.map(({ label, icon: Icon }, index) => (
        <button className="nav-item" aria-current={index === 0 ? "page" : undefined} key={label}>
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function AppShell({ children, actions }) {
  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <a className="wordmark wordmark--vertical" href="#main-content" aria-label="OpenScroll home">
          <span className="wordmark__mark" aria-hidden="true">O</span>
          <span>OpenScroll</span>
        </a>
        <Navigation />
        <p className="rail-note">Open knowledge.<br />Quietly explored.</p>
      </aside>

      <div className="app-column">
        <header className="top-bar">
          <a className="wordmark" href="#main-content" aria-label="OpenScroll home">
            <span className="wordmark__mark" aria-hidden="true">O</span>
            <span>OpenScroll</span>
          </a>
          <div className="top-bar__actions">{actions}</div>
        </header>
        <main id="main-content" tabIndex="-1">{children}</main>
        <Navigation compact />
      </div>
    </div>
  );
}
