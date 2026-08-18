"use client";

import { Compass, FileText, Plus, Sparkles, Trash2 } from "lucide-react";

export function ScrollsManager({ localState, activeScrollId, onSelectScroll, onCreateNew, messages, locale }) {
  const scrolls = localState.scrolls || [];

  return (
    <div className="scrolls-manager-screen">
      <header className="scrolls-header">
        <h1>{messages.myScrolls}</h1>
        <p className="scrolls-subtitle">
          Your saved discovery streams • Fully private and account-free
        </p>
        <button
          type="button"
          className="create-scroll-btn"
          onClick={onCreateNew}
        >
          <Plus size={18} aria-hidden="true" />
          <span>{messages.createScroll}</span>
        </button>
      </header>

      <div className="scrolls-grid">
        {scrolls.length === 0 ? (
          <div className="scrolls-empty">
            <Compass size={40} className="empty-icon" aria-hidden="true" />
            <p>No Scrolls created yet. Type any interest to start your first stream.</p>
          </div>
        ) : (
          scrolls.map((scroll) => {
            const isActive = scroll.id === activeScrollId;
            return (
              <article
                key={scroll.id}
                className={`scroll-card ${isActive ? "scroll-card--active" : ""}`}
                onClick={() => onSelectScroll(scroll)}
                tabIndex="0"
              >
                <div className="scroll-card-header">
                  <div className="scroll-icon-wrap">
                    <Compass size={22} aria-hidden="true" />
                  </div>
                  {isActive ? (
                    <span className="active-badge">{messages.activeScroll}</span>
                  ) : null}
                </div>

                <h2 dir="auto">{scroll.interest}</h2>
                <div className="scroll-topics-list">
                  {scroll.topics?.map((topic) => (
                    <span key={topic} className="scroll-topic-tag">{topic}</span>
                  ))}
                </div>

                <div className="scroll-card-footer">
                  <span className="scroll-date">
                    {new Date(scroll.updatedAt || scroll.createdAt).toLocaleDateString(locale)}
                  </span>
                  <button
                    type="button"
                    className="switch-scroll-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectScroll(scroll);
                    }}
                  >
                    <span>{isActive ? "Resume" : messages.switchScroll}</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
