export default function AppShell({ feedMode, children }) {
  return <div className={`app-shell ${feedMode ? "app-shell--feed" : ""}`}>
    <div className="app-region">
      {!feedMode ? <header className="brand-header"><span className="brand" aria-label="OpenScroll">O</span></header> : null}
      <div className="content-region">{children}</div>
    </div>
  </div>;
}
