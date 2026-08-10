"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, BookmarkCheck, Check, CheckCircle2, Compass, Database, Download, Eraser, FileInput, Globe2, HardDrive, Languages, Music2, RotateCcw, Search } from "lucide-react";
import AppShell from "./app-shell";
import { Chip, IconButton, Sheet, Toast } from "./primitives";
import { directionFor, formatItemCount, messages as catalog } from "../i18n/messages";
import {
  DEFAULT_PREFERENCES,
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

const TOPICS = [["Music", Music2], ["Darija", Languages], ["Architecture", Compass], ["History", BookOpen], ["Open data", Database], ["Culture", Globe2]];
const CARDS = [
  { id: "commons-gnawa-pulse", topic: "Music", title: "The living pulse of Gnawa", original: "نبض كناوة الحي", source: "Wikimedia Commons", color: "#415f4a", Icon: Music2 },
  { id: "wiktionary-darija", topic: "Darija", title: "Darija, written and spoken", original: "الدارجة، مكتوبة ومنطوقة", source: "Wiktionary", color: "#a95e38", Icon: Languages },
  { id: "wikivoyage-medina-history", topic: "History", title: "A brief history of the medina", original: "تاريخ موجز للمدينة العتيقة", source: "Wikivoyage", color: "#607386", Icon: BookOpen }
];
const MEDIA_LABELS = { images: "Images", audio: "Audio", video: "Video", text: "Text", data: "Data" };
const SOURCE_LABELS = { wikimedia: "Wikimedia", openverse: "Openverse", smithsonian: "Smithsonian", europeana: "Europeana", dpla: "DPLA" };

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Available";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${Math.round(value / 1024 / 1024)} MB`;
}

export default function OpenScrollApp() {
  const [step, setStep] = useState(0);
  const [interest, setInterest] = useState("");
  const [selected, setSelected] = useState(new Set(DEFAULT_PREFERENCES.topics));
  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState("system");
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState(null);
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
    setInterest(saved.interest);
    setSelected(new Set(saved.topics));
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
      saveLocalData(state).then(({ status: saveStatus }) => { if (live) setStorageStatus(saveStatus); });
    });
    return () => { live = false; };
  }, []);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = directionFor(locale); }, [locale]);
  useEffect(() => { document.documentElement.dataset.hydrated = "true"; return () => { delete document.documentElement.dataset.hydrated; }; }, []);
  useEffect(() => { if (step === 0 && restoreFocus.current) interestInput.current?.focus(); }, [step]);
  useEffect(() => {
    const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = resolved;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.localLargeText = localState.settings.accessibility.largeText ? "true" : "false";
    document.documentElement.dataset.localReducedMotion = localState.settings.accessibility.reducedMotion ? "true" : "false";
  }, [localState.settings.accessibility.largeText, localState.settings.accessibility.reducedMotion]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 1800); return () => clearTimeout(timer); } }, [toast]);

  function go(next, focusRef) {
    restoreFocus.current = focusRef?.current ?? document.activeElement;
    setStep(next);
    requestAnimationFrame(() => document.querySelector("main input, main button")?.focus());
  }

  function back(next) { setStep(next); }
  function chooseInterest(event) { event.preventDefault(); if (interest.trim()) go(1, interestInput); }
  function toggleTopic(topic) { setSelected((current) => { const next = new Set(current); next.has(topic) ? next.delete(topic) : next.add(topic); return next; }); }

  function openFeed() {
    if (!selected.size) { setToast(messages.empty); return; }
    commitState(recordScrollCreation(localState, { interest: interest.trim(), topics: [...selected] }), messages.saved);
    setStep(2);
  }

  function returnToExplore({ focusInput = false } = {}) {
    restoreFocus.current = focusInput;
    setStep(0);
  }

  function changeSettings(patch, message = messages.saved) {
    commitState(updateLocalSettings(localState, patch), message);
  }

  function toggleSave(card) {
    const wasSaved = localState.saves.some((save) => save.itemId === card.id);
    commitState(toggleSavedItem(localState, card), wasSaved ? messages.removed : messages.saved);
  }

  function markUseful(card) {
    commitState(recordExplicitFeedback(localState, card), messages.saved);
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
      setStep(0);
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
    setStep(0);
    commitState(resetLocalState(), messages.reset, { syncJourney: true });
  }

  const storageCopy = storageStatus.availability === "ready" ? messages.ready : messages.limited;
  const storageUse = storageEstimate.percent === null ? formatBytes(storageEstimate.usage) : `${storageEstimate.percent}%`;

  return <AppShell activeNav={sheet === "settings" ? "settings" : step === 0 ? "search" : "explore"} feedMode={step === 2} messages={messages} onExplore={() => returnToExplore()} onSearch={() => returnToExplore({ focusInput: true })} onSettings={() => setSheet("settings")}>
    <main className={`journey ${isRtl ? "journey--rtl" : ""}`}>
      {step === 0 ? <section className="screen opening-screen" aria-labelledby="explore-title"><h1 id="explore-title">{messages.explore}</h1><form className="search-control" onSubmit={chooseInterest}><Search aria-hidden="true"/><label htmlFor="interest" className="sr-only">{messages.interest}</label><input ref={interestInput} id="interest" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder={messages.placeholder} dir="auto" maxLength={120}/><IconButton className="submit-control" type="submit" disabled={!interest.trim()} label={messages.continue}><ArrowRight className="directional-icon" aria-hidden="true"/></IconButton></form></section> : null}
      {step === 1 ? <section className="screen topic-screen" aria-label={messages.choose}><IconButton className="back-control" label={messages.back} onClick={() => back(0)}><ArrowLeft className="directional-icon" aria-hidden="true"/></IconButton><div className="topics">{TOPICS.map(([topic, Icon]) => <Chip key={topic} selected={selected.has(topic)} onClick={() => toggleTopic(topic)}>{selected.has(topic) ? <Check className="check" aria-hidden="true"/> : null}<Icon aria-hidden="true"/><span>{topic}</span></Chip>)}</div><IconButton className="build-control" label={`${messages.build}, ${formatItemCount(locale, selected.size)}`} onClick={openFeed} disabled={!selected.size}><ArrowRight className="directional-icon" aria-hidden="true"/></IconButton></section> : null}
      {step === 2 ? <section className="feed" aria-label={`${interest} feed`}><header className="feed-header"><IconButton label={messages.back} onClick={() => back(1)}><ArrowLeft className="directional-icon" aria-hidden="true"/></IconButton><strong dir="auto">{interest}</strong><IconButton label={messages.details} onClick={() => setSheet("details")}><Globe2 aria-hidden="true"/></IconButton></header>{CARDS.filter((card) => selected.has(card.topic)).map((card) => {
        const Icon = card.Icon;
        const saved = localState.saves.some((save) => save.itemId === card.id);
        return <article className="feed-card" key={card.title} style={{ "--card-color": card.color }} tabIndex="0"><div className="feed-art"><Icon aria-hidden="true"/></div><div className="feed-actions"><IconButton aria-pressed={saved} label={saved ? messages.removeSave : messages.saveItem} onClick={() => toggleSave(card)}>{saved ? <BookmarkCheck aria-hidden="true"/> : <Bookmark aria-hidden="true"/>}</IconButton><IconButton label={messages.moreLikeThis} onClick={() => markUseful(card)}><CheckCircle2 aria-hidden="true"/></IconButton></div><div className="feed-content"><h2 dir="auto">{locale === "ar" ? card.original : card.title}</h2><span><span className="sr-only">{messages.source}: </span>{card.source}</span></div></article>;
      })}</section> : null}
      <Sheet open={Boolean(sheet)} title={sheet === "settings" ? messages.settings : interest || "OpenScroll"} onClose={() => setSheet(null)}>
        {sheet === "settings" ? <div className="settings-panel">
          <p className="local-disclosure">{messages.localDisclosure}</p>
          <section className="settings-section" aria-labelledby="language-setting"><h3 id="language-setting">{messages.language}</h3><div className="segmented">{["en", "es", "ar"].map((item) => <button type="button" key={item} className="segmented__option" aria-pressed={locale === item} onClick={() => changeSettings({ locale: item })}>{item.toUpperCase()}</button>)}</div></section>
          <section className="settings-section" aria-labelledby="theme-setting"><h3 id="theme-setting">{messages.theme}</h3><div className="segmented">{["system", "light", "dark"].map((item) => <button type="button" key={item} className="segmented__option" aria-pressed={theme === item} onClick={() => changeSettings({ theme: item })}>{messages[item]}</button>)}</div></section>
          <section className="settings-section" aria-labelledby="media-setting"><h3 id="media-setting">{messages.media}</h3><div className="toggle-grid">{Object.entries(MEDIA_LABELS).map(([key, label]) => <label className="toggle-pill" key={key}><input type="checkbox" checked={localState.settings.media[key]} onChange={() => changeSettings({ media: { [key]: !localState.settings.media[key] } })}/><span>{label}</span></label>)}</div></section>
          <section className="settings-section" aria-labelledby="source-setting"><h3 id="source-setting">{messages.sources}</h3><div className="toggle-grid">{Object.entries(SOURCE_LABELS).map(([key, label]) => <label className="toggle-pill" key={key}><input type="checkbox" checked={localState.settings.sources[key]} onChange={() => changeSettings({ sources: { [key]: !localState.settings.sources[key] } })}/><span>{label}</span></label>)}</div></section>
          <section className="settings-section" aria-labelledby="privacy-setting"><h3 id="privacy-setting">{messages.privacy}</h3><div className="toggle-grid"><label className="toggle-pill"><input type="checkbox" checked={localState.settings.privacy.saveHistory} onChange={() => changeSettings({ privacy: { saveHistory: !localState.settings.privacy.saveHistory } })}/><span>{messages.history}</span></label><label className="toggle-pill"><input type="checkbox" checked={localState.settings.accessibility.largeText} onChange={() => changeSettings({ accessibility: { largeText: !localState.settings.accessibility.largeText } })}/><span>{messages.largeText}</span></label><label className="toggle-pill"><input type="checkbox" checked={localState.settings.accessibility.reducedMotion} onChange={() => changeSettings({ accessibility: { reducedMotion: !localState.settings.accessibility.reducedMotion } })}/><span>{messages.reducedMotion}</span></label></div></section>
          <section className="settings-section" aria-labelledby="storage-setting"><h3 id="storage-setting">{messages.storage}</h3><dl className="storage-status"><div><dt>{messages.status}</dt><dd>{storageCopy}</dd></div><div><dt>{messages.used}</dt><dd>{storageUse}</dd></div><div><dt>{messages.persistence}</dt><dd>{storageEstimate.persisted ? messages.protected : messages.bestEffort}</dd></div><div><dt>{messages.savedItems}</dt><dd>{formatItemCount(locale, localState.saves.length)}</dd></div></dl><div className="settings-actions"><button type="button" className="storage-button" onClick={requestPersistence}><HardDrive aria-hidden="true"/>{messages.keep}</button><button type="button" className="storage-button" onClick={exportData}><Download aria-hidden="true"/>{messages.export}</button><button type="button" className="storage-button" onClick={() => importInput.current?.click()}><FileInput aria-hidden="true"/>{messages.import}</button><button type="button" className="storage-button" onClick={() => commitState(clearLocalHistory(localState), messages.cleared)}><Eraser aria-hidden="true"/>{messages.clearHistory}</button><button type="button" className="storage-button storage-button--danger" onClick={resetData}><RotateCcw aria-hidden="true"/>{messages.resetData}</button><input ref={importInput} className="sr-only" type="file" accept="application/json" onChange={importData}/></div></section>
        </div> : <div className="settings-panel"><p className="local-disclosure">{messages.localDisclosure}</p><dl className="storage-status"><div><dt>{messages.choose}</dt><dd>{formatItemCount(locale, selected.size)}</dd></div><div><dt>{messages.savedItems}</dt><dd>{formatItemCount(locale, localState.saves.length)}</dd></div><div><dt>{messages.collections}</dt><dd>{formatItemCount(locale, localState.collections.length)}</dd></div><div><dt>{messages.history}</dt><dd>{formatItemCount(locale, localState.history.length)}</dd></div></dl></div>}
      </Sheet><Toast message={toast}/>
    </main>
  </AppShell>;
}
