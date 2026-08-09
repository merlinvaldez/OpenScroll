"use client";
import { Compass, Languages, Moon, Search, Settings, Sun } from "lucide-react";
import { IconButton } from "./primitives";

export default function AppShell({ locale, theme, messages, feedMode, onLocale, onTheme, onSearch, children }) {
  return <div className={`app-shell ${feedMode ? "app-shell--feed" : ""}`}>
    {!feedMode ? <aside className="navigation-rail" aria-label="Primary"><span className="brand" aria-label="OpenScroll">O</span><IconButton label={messages.explore} expanded onClick={onSearch}><Compass aria-hidden="true"/></IconButton><IconButton label="Search" expanded onClick={onSearch}><Search aria-hidden="true"/></IconButton><IconButton label="Settings" expanded><Settings aria-hidden="true"/></IconButton></aside> : null}
    <div className="app-region">
      {!feedMode ? <header className="utility-bar"><span className="brand brand--mobile" aria-label="OpenScroll">O</span><div className="utility-actions"><label className="locale-select"><Languages aria-hidden="true"/><span className="sr-only">{messages.language}</span><select value={locale} onChange={(event) => onLocale(event.target.value)} aria-label={messages.language}><option value="en">EN</option><option value="es">ES</option><option value="ar">AR</option></select></label><IconButton label={messages.theme} onClick={onTheme}>{theme === "dark" ? <Sun aria-hidden="true"/> : <Moon aria-hidden="true"/>}</IconButton></div></header> : null}
      <div className="content-region">{children}</div>
      {!feedMode ? <nav className="bottom-nav" aria-label="Primary"><IconButton label={messages.explore} expanded onClick={onSearch}><Compass aria-hidden="true"/></IconButton><IconButton label="Search" expanded onClick={onSearch}><Search aria-hidden="true"/></IconButton><IconButton label="Settings" expanded><Settings aria-hidden="true"/></IconButton></nav> : null}
    </div>
    {!feedMode ? <aside className="context-region" aria-label="Context"><span aria-hidden="true">○</span></aside> : null}
  </div>;
}
