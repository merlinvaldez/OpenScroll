"use client";

import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { IconButton } from "./primitives";

export function SavedLibrary({ localState, onToggleSave, onOpenCard, messages, locale }) {
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const saves = localState.saves || [];
  const collections = localState.collections || [];

  const filteredSaves = saves.filter((save) => {
    const matchesCollection =
      selectedCollection === "all" ||
      (save.collectionIds && save.collectionIds.includes(selectedCollection));
    const matchesSearch =
      !searchQuery.trim() ||
      save.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      save.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCollection && matchesSearch;
  });

  return (
    <div className="saved-library-screen">
      <header className="library-header">
        <h1>{messages.savedItems}</h1>
        <p className="library-subtitle">
          {saves.length} {messages.itemCount} • Saved privately in this browser
        </p>

        <div className="library-search-bar">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder={messages.searchSaved}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={messages.searchSaved}
          />
        </div>
      </header>

      <section className="collections-bar" aria-label={messages.collections}>
        <button
          type="button"
          className={`collection-pill ${selectedCollection === "all" ? "collection-pill--active" : ""}`}
          onClick={() => setSelectedCollection("all")}
        >
          <Bookmark size={15} aria-hidden="true" />
          <span>{messages.allSaved} ({saves.length})</span>
        </button>

        {collections.map((col) => {
          const count = saves.filter((s) => s.collectionIds?.includes(col.id)).length;
          return (
            <button
              key={col.id}
              type="button"
              className={`collection-pill ${selectedCollection === col.id ? "collection-pill--active" : ""}`}
              onClick={() => setSelectedCollection(col.id)}
            >
              <Folder size={15} aria-hidden="true" />
              <span>{col.name} ({count})</span>
            </button>
          );
        })}
      </section>

      {filteredSaves.length === 0 ? (
        <div className="library-empty">
          <Bookmark size={40} className="empty-icon" aria-hidden="true" />
          <p>{messages.emptySaved}</p>
        </div>
      ) : (
        <div className="saved-grid">
          {filteredSaves.map((save) => (
            <article key={save.id} className="saved-card" tabIndex="0">
              <div className="saved-card-body">
                <span className="saved-source">{save.source}</span>
                <h3 dir="auto">{save.title}</h3>
                <span className="saved-license">{save.rightsSnapshot?.license || "Verified open"}</span>
                <p className="saved-attr">{save.rightsSnapshot?.attribution}</p>
              </div>
              <div className="saved-card-actions">
                <button
                  type="button"
                  className="saved-action-btn"
                  onClick={() => onToggleSave({ id: save.itemId, title: save.title, source: save.source })}
                  aria-label={messages.removeSave}
                >
                  <BookmarkCheck size={18} aria-hidden="true" />
                  <span>{messages.saved}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
