import { Compass, Search, Settings } from "lucide-react";
import { IconButton } from "./primitives";

export default function AppShell({ feedMode, messages, onExplore, onSearch, onSettings, children }) {
  return <div className={`app-shell ${feedMode ? "app-shell--feed" : ""}`}>
    <div className="app-region">
      {!feedMode ? <header className="brand-header"><span className="brand" aria-label="OpenScroll">O</span></header> : null}
      <div className="content-region">{children}</div>
      {!feedMode ? <nav className="bottom-nav" aria-label={messages.navigation}>
        <IconButton label={messages.exploreNav} onClick={onExplore}><Compass aria-hidden="true"/></IconButton>
        <IconButton label={messages.search} onClick={onSearch}><Search aria-hidden="true"/></IconButton>
        <IconButton label={messages.settings} onClick={onSettings}><Settings aria-hidden="true"/></IconButton>
      </nav> : null}
    </div>
  </div>;
}
