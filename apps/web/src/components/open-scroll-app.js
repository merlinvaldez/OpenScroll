"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eraser,
  FileInput,
  Globe2,
  HardDrive,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
  canonicalMoroccoSample
} from "@openscroll/content";
import AppShell from "./app-shell";
import { UniversalCard, SessionBreathingCard } from "./media-cards";
import {
  BranchExplorationSheet,
  FocusedViewerModal,
  WhyOpenSheet,
  WhyThisSheet
} from "./sheets";
import { SavedLibrary } from "./saved-library";
import { ScrollsManager } from "./scrolls-manager";
import { EditorialExplore } from "./editorial-explore";
import { IconButton, Sheet, Toast } from "./primitives";
import { directionFor, formatItemCount, messages as catalog } from "../i18n/messages";
import {
  clearLocalHistory,
  createDefaultLocalState,
  getDeviceStorageStatus,
  loadLocalData,
  parseLocalImport,
  preferencesFromState,
  recordExplicitFeedback,
  recordScrollCreation,
  requestLocalPersistence,
  resetLocalState,
  saveLocalData,
  serializeLocalExport,
  toggleSavedItem,
  updateLocalSettings
} from "../lib/preferences";

function transformUcoToCard(object) {
  const topic = object.knowledge?.topics?.[0] || object.content?.topics?.[0] || "Culture";
  return {
    id: object.id,
    topic,
    title: object.content?.title || "Artifact",
    original: object.content?.originalTitle || object.content?.title,
    source: object.source?.name || "Open Archive",
    creator: object.creator?.names?.map((c) => c.name).join(", ") || object.creator?.institution || "",
    license: object.rights?.label || "Open License",
    attribution: object.rights?.attributionNotice?.text || object.rights?.attribution || "",
    whyOpen: object.rights?.whyOpen?.bullets || [],
    openBasis: object.rights?.whyOpen?.headline || "Verified open for OpenScroll",
    downloadRule: object.rights?.downloadPolicy?.notice || "Allowed with attribution",
    downloadAllowed: object.rights?.downloadPolicy?.allowed !== false,
    downloadUrl: object.rights?.downloadPolicy?.files?.mediaUrl || object.identity?.originalSourceUrl || object.media?.url,
    reason: `${topic} from ${object.knowledge?.collection || object.source?.name}`,
    sourceHealth: object.system?.sourceHealth || "healthy",
    rightsSnapshot: {
      basis: object.rights?.whyOpen?.basis || "qualified-open-license",
      source: object.source?.name,
      license: object.rights?.label,
      attribution: object.rights?.attributionNotice?.text,
      obligations: object.rights?.obligations || [],
      downloadAllowed: object.rights?.downloadPolicy?.allowed !== false,
      downloadNotice: object.rights?.downloadPolicy?.notice
    },
    object
  };
}

const INITIAL_CARDS = canonicalMoroccoSample.map(transformUcoToCard);

const MEDIA_LABELS = { images: "Images", audio: "Audio", video: "Video", text: "Text", data: "Data" };
const SOURCE_LABELS = { wikimedia: "Wikimedia", openverse: "Openverse", smithsonian: "Smithsonian", europeana: "Europeana", dpla: "DPLA" };

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Available";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${Math.round(value / 1024 / 1024)} MB`;
}

function createFeedSeed() {
  return Math.floor(Math.random() * 0x100000000);
}

export default function OpenScrollApp() {
  // Navigation: "explore" | "search" | "feed" | "scrolls" | "saved" | "settings"
  const [currentView, setCurrentView] = useState("search");
  const [interest, setInterest] = useState("");
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  const [cards, setCards] = useState(INITIAL_CARDS);
  const [feedCursor, setFeedCursor] = useState(0);
  const [feedSeed, setFeedSeed] = useState(null);
  const [feedSourceOffsets, setFeedSourceOffsets] = useState({});
  const [feedExhausted, setFeedExhausted] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const bottomSentinelRef = useRef(null);

  const [activeCard, setActiveCard] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // "branch" | "whyThis" | "whyOpen" | "viewer" | "settings"
  const [viewerMode, setViewerMode] = useState("image");

  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState("system");
  const [toast, setToast] = useState("");
  const [localState, setLocalState] = useState(() => createDefaultLocalState());
  const [storageStatus, setStorageStatus] = useState({ availability: "checking", message: "" });
  const [storageEstimate, setStorageEstimate] = useState({ persisted: false, usage: null, quota: null, percent: null });

  const restoreFocus = useRef(null);
  const interestInput = useRef(null);
  const importInput = useRef(null);
  const messages = catalog[locale] ?? catalog.en;
  const isRtl = directionFor(locale) === "rtl";

  function applyJourneyState(nextState) {
    const saved = preferencesFromState(nextState);
    if (saved.interest) setInterest(saved.interest);
    setLocale(saved.locale);
    setTheme(saved.theme);
  }

  async function refreshStorageEstimate() {
    setStorageEstimate(await getDeviceStorageStatus());
  }

  function commitState(nextState, message, { syncJourney = false } = {}) {
    setLocalState(nextState);
    setLocale(nextState.settings.locale);
    setTheme(nextState.settings.theme);
    if (syncJourney) applyJourneyState(nextState);
    saveLocalData(nextState).then(({ status }) => {
      setStorageStatus(status);
      refreshStorageEstimate();
      if (message) setToast(message);
    });
  }

  useEffect(() => {
    let live = true;
    loadLocalData().then(({ state, status }) => {
      if (!live) return;
      setLocalState(state);
      setStorageStatus(status);
      applyJourneyState(state);
      refreshStorageEstimate();
      saveLocalData(state).then(({ status: saveStatus }) => {
        if (live) setStorageStatus(saveStatus);
      });
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  useEffect(() => {
    const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = resolved;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.localLargeText = localState.settings.accessibility.largeText ? "true" : "false";
    document.documentElement.dataset.localReducedMotion = localState.settings.accessibility.reducedMotion ? "true" : "false";
  }, [localState.settings.accessibility.largeText, localState.settings.accessibility.reducedMotion]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (currentView === "search" && interestInput.current) {
      interestInput.current.focus();
    }
  }, [currentView]);

  async function handleSearchSubmit(event) {
    if (event) event.preventDefault();
    const query = interest.trim();
    if (!query) return;
    await handleBuildScroll(query);
  }

  async function handleBuildScroll(overrideInterest) {
    const isStringOverride = typeof overrideInterest === "string";
    const cleanInterest = (isStringOverride ? overrideInterest : interest).trim();

    if (!cleanInterest) {
      setToast("Enter a search term to build a feed.");
      return;
    }

    const nextSeed = createFeedSeed();
    setIsLoadingFeed(true);
    setCurrentView("feed");
    setCards([]);
    setFeedSeed(nextSeed);
    setFeedCursor(null);
    setFeedSourceOffsets({});
    setFeedExhausted(false);

    try {
      const res = await fetch("/api/feed/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interest: cleanInterest,
          feedback: localState.feedback,
          pageSize: 25,
          seed: nextSeed
        })
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "The Wikimedia Commons feed could not be built.");
      }

      const composedItems = payload?.data?.items || [];
      if (!composedItems.length) {
        setCards([]);
        setFeedCursor(null);
        setFeedSourceOffsets(payload?.data?.sourceOffsets || {});
        setFeedExhausted(true);
        setToast("No semantic matches found. End of feed.");
        return;
      }

      const transformedCards = composedItems.map(transformUcoToCard);
      setCards(transformedCards);
      setFeedCursor(payload.data.pagination?.nextCursor ?? null);
      setFeedSourceOffsets(payload.data.sourceOffsets || {});
      setFeedExhausted(payload.data.sourceHasMore === false);

      // 3. Save scroll to local state
      commitState(
        recordScrollCreation(localState, {
          interest: cleanInterest,
          topics: [cleanInterest]
        }),
        messages.saved
      );

      setCurrentView("feed");
    } catch (error) {
      setToast(error.message);
    } finally {
      setIsLoadingFeed(false);
    }
  }

  // Endless Infinite Scroll Loader
  async function handleLoadMoreCards() {
    if (isLoadingFeed || isLoadingMore || currentView !== "feed" || (feedCursor === null && feedExhausted)) return;
    setIsLoadingMore(true);

    try {
      const requestingNextSourceBatch = feedCursor === null;
      const nextCursor = requestingNextSourceBatch ? 0 : feedCursor;
      const cleanInterest = interest.trim();

      const res = await fetch("/api/feed/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interest: cleanInterest,
          feedback: localState.feedback,
          cursor: nextCursor,
          pageSize: 25,
          seed: feedSeed,
          sourceOffsets: feedSourceOffsets
        })
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || "The Wikimedia Commons feed could not be extended.");
      }

      const nextItems = payload?.data?.items || [];
      setFeedSourceOffsets(payload?.data?.sourceOffsets || {});
      setFeedExhausted(!nextItems.length || payload?.data?.sourceHasMore === false);

      if (nextItems.length) {
        const nextCards = nextItems.map(transformUcoToCard);
        setCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = nextCards.filter((c) => !existingIds.has(c.id));
          return uniqueNew.length ? [...prev, ...uniqueNew] : prev;
        });
        setFeedCursor(payload.data.pagination?.nextCursor ?? null);
      } else {
        setFeedCursor(null);
      }
    } catch (error) {
      setToast(error.message);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Infinite Scroll Intersection Observer
  useEffect(() => {
    if (currentView !== "feed") return;
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingFeed && !isLoadingMore) {
          handleLoadMoreCards();
        }
      },
      { rootMargin: "600px 0px 600px 0px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentView, feedCursor, feedSeed, feedSourceOffsets, feedExhausted, isLoadingFeed, isLoadingMore, interest]);

  function handleToggleSave(card) {
    const wasSaved = localState.saves.some((save) => save.itemId === card.id);
    commitState(toggleSavedItem(localState, card), wasSaved ? messages.removed : messages.saved);
  }

  function handleFeedback(card, action, toastMsg) {
    commitState(recordExplicitFeedback(localState, card, action), toastMsg || messages.saved);
    setActiveModal(null);
  }

  function handleBranchExplore(concept) {
    setInterest(concept);
    setActiveModal(null);
    handleBuildScroll(concept);
  }

  function handleAddToScroll(concept) {
    setInterest((current) => [current, concept].filter(Boolean).join(" "));
    setActiveModal(null);
    setToast(`Added ${concept} to current Scroll`);
  }

  function handleSelectScroll(scroll) {
    setInterest(scroll.interest);
    handleBuildScroll(scroll.interest);
  }

  function handleStartExploreJourney(query) {
    setInterest(query);
    handleBuildScroll(query);
  }

  function handleOpenViewer(card, mode) {
    setActiveCard(card);
    setViewerMode(mode);
    setActiveModal("viewer");
  }

  function changeSettings(patch, message = messages.saved) {
    commitState(updateLocalSettings(localState, patch), message);
  }

  function exportData() {
    const blob = new Blob([serializeLocalExport(localState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `openscroll-local-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setToast(messages.exported);
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseLocalImport(await file.text());
      setCurrentView("search");
      commitState(imported, messages.imported, { syncJourney: true });
    } catch {
      setToast(messages.importFailed);
    } finally {
      event.target.value = "";
    }
  }

  async function requestPersistence() {
    const granted = await requestLocalPersistence();
    await refreshStorageEstimate();
    setToast(granted ? messages.persistenceOn : messages.persistenceLimited);
  }

  function resetData() {
    setCurrentView("search");
    commitState(resetLocalState(), messages.reset, { syncJourney: true });
  }

  const storageCopy = storageStatus.availability === "ready" ? messages.ready : messages.limited;
  const storageUse = storageEstimate.percent === null ? formatBytes(storageEstimate.usage) : `${storageEstimate.percent}%`;

  return (
    <AppShell
      activeNav={currentView}
      feedMode={currentView === "feed"}
      messages={messages}
      onScrolls={() => setCurrentView("scrolls")}
      onExplore={() => setCurrentView("explore")}
      onSaved={() => setCurrentView("saved")}
      onSettings={() => setCurrentView("settings")}
      onBrandClick={() => setCurrentView("search")}
    >
      <main className={`journey ${isRtl ? "journey--rtl" : ""}`}>
        {/* VIEW 1: SEARCH / INTEREST ENTRY */}
        {currentView === "search" ? (
          <section className="screen opening-screen" aria-labelledby="explore-title">
            <h1 id="explore-title">{messages.explore}</h1>
            <form className="search-control" onSubmit={handleSearchSubmit}>
              <Search aria-hidden="true" />
              <label htmlFor="interest" className="sr-only">
                {messages.interest}
              </label>
              <input
                ref={interestInput}
                id="interest"
                value={interest}
                onChange={(event) => setInterest(event.target.value)}
                placeholder={messages.placeholder}
                dir="auto"
                maxLength={120}
                autoFocus
              />
              <IconButton
                className="submit-control"
                type="submit"
                disabled={!interest.trim()}
                label={messages.continue}
              >
                <ArrowRight className="directional-icon" aria-hidden="true" />
              </IconButton>
            </form>
          </section>
        ) : null}

        {/* VIEW 2: MULTIMEDIA FEED */}
        {currentView === "feed" ? (
          <section className="feed" aria-label={`${interest} stream`}>
            <header className="feed-header">
              <IconButton label={messages.back} onClick={() => setCurrentView("search")}>
                <ArrowLeft className="directional-icon" aria-hidden="true" />
              </IconButton>
              <strong dir="auto">{interest}</strong>
              <IconButton label={messages.details} onClick={() => setActiveModal("details")}>
                <Globe2 aria-hidden="true" />
              </IconButton>
            </header>

            {cards.map((card) => {
              const saved = localState.saves.some((save) => save.itemId === card.id);
              return (
                <UniversalCard
                  key={card.id}
                  card={card}
                  saved={saved}
                  onToggleSave={handleToggleSave}
                  onWhyThis={(c) => {
                    setActiveCard(c);
                    setActiveModal("whyThis");
                  }}
                  onWhyOpen={(c) => {
                    setActiveCard(c);
                    setActiveModal("whyOpen");
                  }}
                  onBranch={(c) => {
                    setActiveCard(c);
                    setActiveModal("branch");
                  }}
                  onOpenViewer={handleOpenViewer}
                  messages={messages}
                  locale={locale}
                />
              );
            })}

            {/* Infinite scroll stream */}
            <div ref={bottomSentinelRef} className="infinite-stream-sentinel" aria-live="polite">
              {isLoadingFeed || isLoadingMore ? (
                <div className="infinite-stream-loader">
                  <Sparkles className="icon-sm spin" aria-hidden="true" />
                  <span>Loading more from the open feed...</span>
                </div>
              ) : feedExhausted ? (
                <div className="infinite-stream-loader infinite-stream-loader--subtle">
                  <span className="stream-dot" aria-hidden="true" />
                  <span>End of feed</span>
                </div>
              ) : (
                <div className="infinite-stream-loader infinite-stream-loader--subtle">
                  <span className="stream-dot" aria-hidden="true" />
                  <span>Infinite Open Stream • Scroll for as long as you like</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* VIEW 4: SCROLLS MANAGER */}
        {currentView === "scrolls" ? (
          <ScrollsManager
            localState={localState}
            activeScrollId={localState.scrolls?.[0]?.id}
            onSelectScroll={handleSelectScroll}
            onCreateNew={() => {
              setInterest("");
              setCurrentView("search");
            }}
            messages={messages}
            locale={locale}
          />
        ) : null}

        {/* VIEW 5: EDITORIAL EXPLORE */}
        {currentView === "explore" ? (
          <EditorialExplore
            onSelectJourney={handleStartExploreJourney}
            messages={messages}
            locale={locale}
          />
        ) : null}

        {/* VIEW 6: SAVED LIBRARY */}
        {currentView === "saved" ? (
          <SavedLibrary
            localState={localState}
            onToggleSave={handleToggleSave}
            onOpenCard={(c) => handleOpenViewer(c, "reader")}
            messages={messages}
            locale={locale}
          />
        ) : null}

        {/* VIEW 7: SETTINGS SCREEN */}
        {currentView === "settings" ? (
          <section className="screen settings-screen" aria-labelledby="settings-title">
            <h1 id="settings-title">{messages.settings}</h1>
            <p className="local-disclosure">{messages.localDisclosure}</p>

            <section className="settings-section">
              <h3>{messages.language}</h3>
              <div className="segmented">
                {["en", "es", "ar"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className="segmented__option"
                    aria-pressed={locale === item}
                    onClick={() => changeSettings({ locale: item })}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h3>{messages.theme}</h3>
              <div className="segmented">
                {["system", "light", "dark"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className="segmented__option"
                    aria-pressed={theme === item}
                    onClick={() => changeSettings({ theme: item })}
                  >
                    {messages[item]}
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h3>{messages.media}</h3>
              <div className="toggle-grid">
                {Object.entries(MEDIA_LABELS).map(([key, label]) => (
                  <label className="toggle-pill" key={key}>
                    <input
                      type="checkbox"
                      checked={localState.settings.media[key]}
                      onChange={() => changeSettings({ media: { [key]: !localState.settings.media[key] } })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h3>{messages.sources}</h3>
              <div className="toggle-grid">
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <label className="toggle-pill" key={key}>
                    <input
                      type="checkbox"
                      checked={localState.settings.sources[key]}
                      onChange={() => changeSettings({ sources: { [key]: !localState.settings.sources[key] } })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h3>{messages.privacy}</h3>
              <div className="toggle-grid">
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={localState.settings.privacy.saveHistory}
                    onChange={() => changeSettings({ privacy: { saveHistory: !localState.settings.privacy.saveHistory } })}
                  />
                  <span>{messages.history}</span>
                </label>
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={localState.settings.accessibility.largeText}
                    onChange={() => changeSettings({ accessibility: { largeText: !localState.settings.accessibility.largeText } })}
                  />
                  <span>{messages.largeText}</span>
                </label>
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={localState.settings.accessibility.reducedMotion}
                    onChange={() => changeSettings({ accessibility: { reducedMotion: !localState.settings.accessibility.reducedMotion } })}
                  />
                  <span>{messages.reducedMotion}</span>
                </label>
              </div>
            </section>

            <section className="settings-section">
              <h3>{messages.storage}</h3>
              <dl className="storage-status">
                <div>
                  <dt>{messages.status}</dt>
                  <dd>{storageCopy}</dd>
                </div>
                <div>
                  <dt>{messages.used}</dt>
                  <dd>{storageUse}</dd>
                </div>
                <div>
                  <dt>{messages.persistence}</dt>
                  <dd>{storageEstimate.persisted ? messages.protected : messages.bestEffort}</dd>
                </div>
                <div>
                  <dt>{messages.savedItems}</dt>
                  <dd>{formatItemCount(locale, localState.saves.length)}</dd>
                </div>
              </dl>

              <div className="settings-actions">
                <button type="button" className="storage-button" onClick={requestPersistence}>
                  <HardDrive size={18} aria-hidden="true" />
                  <span>{messages.keep}</span>
                </button>
                <button type="button" className="storage-button" onClick={exportData}>
                  <Download size={18} aria-hidden="true" />
                  <span>{messages.export}</span>
                </button>
                <button type="button" className="storage-button" onClick={() => importInput.current?.click()}>
                  <FileInput size={18} aria-hidden="true" />
                  <span>{messages.import}</span>
                </button>
                <button type="button" className="storage-button" onClick={() => commitState(clearLocalHistory(localState), messages.cleared)}>
                  <Eraser size={18} aria-hidden="true" />
                  <span>{messages.clearHistory}</span>
                </button>
                <button type="button" className="storage-button storage-button--danger" onClick={resetData}>
                  <RotateCcw size={18} aria-hidden="true" />
                  <span>{messages.resetData}</span>
                </button>
                <input ref={importInput} className="sr-only" type="file" accept="application/json" onChange={importData} />
              </div>
            </section>
          </section>
        ) : null}

        {/* MODAL & CONTEXT SHEETS */}
        <BranchExplorationSheet
          open={activeModal === "branch"}
          card={activeCard}
          onClose={() => setActiveModal(null)}
          onExploreBranch={handleBranchExplore}
          onAddToScroll={handleAddToScroll}
          messages={messages}
          locale={locale}
        />

        <WhyThisSheet
          open={activeModal === "whyThis"}
          card={activeCard}
          rootInterest={interest}
          onClose={() => setActiveModal(null)}
          onFeedback={handleFeedback}
          messages={messages}
          locale={locale}
        />

        <WhyOpenSheet
          open={activeModal === "whyOpen"}
          card={activeCard}
          onClose={() => setActiveModal(null)}
          messages={messages}
          locale={locale}
        />

        <FocusedViewerModal
          open={activeModal === "viewer"}
          card={activeCard}
          mode={viewerMode}
          onClose={() => setActiveModal(null)}
          messages={messages}
          locale={locale}
        />

        {/* GENERIC FEED DETAILS SHEET */}
        <Sheet open={activeModal === "details"} title={interest || "OpenScroll Stream"} onClose={() => setActiveModal(null)}>
          <div className="settings-panel">
            <p className="local-disclosure">{messages.localDisclosure}</p>
            <dl className="storage-status">
              <div>
                <dt>{messages.interest}</dt>
                <dd dir="auto">{interest}</dd>
              </div>
              <div>
                <dt>{messages.savedItems}</dt>
                <dd>{formatItemCount(locale, localState.saves.length)}</dd>
              </div>
              <div>
                <dt>{messages.collections}</dt>
                <dd>{formatItemCount(locale, localState.collections.length)}</dd>
              </div>
              <div>
                <dt>{messages.history}</dt>
                <dd>{formatItemCount(locale, localState.history.length)}</dd>
              </div>
            </dl>
          </div>
        </Sheet>

        <Toast message={toast} />
      </main>
    </AppShell>
  );
}
