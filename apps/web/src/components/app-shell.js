import { Compass, Search, Settings } from "lucide-react";
import { IconButton } from "./primitives";

export default function AppShell({ activeNav = "explore", feedMode, messages, onExplore, onSearch, onSettings, children }) {
  return <div className={`app-shell ${feedMode ? "app-shell--feed" : ""}`}>
    <div className="app-region">
      {!feedMode ? <header className="brand-header"><span className="brand" aria-label="OpenScroll">O</span></header> : null}
      <div className="content-region">{children}</div>
      {!feedMode ? <nav className="bottom-nav" aria-label={messages.navigation}>
        <IconButton aria-current={activeNav === "explore" ? "page" : undefined} label={messages.exploreNav} onClick={onExplore}><Compass aria-hidden="true"/></IconButton>
        <IconButton aria-current={activeNav === "search" ? "page" : undefined} label={messages.search} onClick={onSearch}><Search aria-hidden="true"/></IconButton>
        <IconButton aria-current={activeNav === "settings" ? "page" : undefined} label={messages.settings} onClick={onSettings}><Settings aria-hidden="true"/></IconButton>
      </nav> : null}
    </div>
  </div>;
}
