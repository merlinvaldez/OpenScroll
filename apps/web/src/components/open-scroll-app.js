"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Database, Globe2, Languages, Music2, Search } from "lucide-react";
import AppShell from "./app-shell";
import { Chip, IconButton, Sheet, Toast } from "./primitives";
import { directionFor, formatItemCount, messages as catalog } from "../i18n/messages";
import { DEFAULT_PREFERENCES, PREFERENCE_KEY, parsePreferences } from "../lib/preferences";

const TOPICS = [["Music", Music2], ["Darija", Languages], ["Architecture", Compass], ["History", BookOpen], ["Open data", Database], ["Culture", Globe2]];
const CARDS = [
  { topic: "Music", title: "The living pulse of Gnawa", original: "نبض كناوة الحي", source: "Wikimedia Commons", color: "#415f4a", Icon: Music2 },
  { topic: "Darija", title: "Darija, written and spoken", original: "الدارجة، مكتوبة ومنطوقة", source: "Wiktionary", color: "#a95e38", Icon: Languages },
  { topic: "History", title: "A brief history of the medina", original: "تاريخ موجز للمدينة العتيقة", source: "Wikivoyage", color: "#607386", Icon: BookOpen }
];

export default function OpenScrollApp() {
  const [step, setStep] = useState(0);
  const [interest, setInterest] = useState(""); const [selected, setSelected] = useState(new Set(DEFAULT_PREFERENCES.topics));
  const [locale, setLocale] = useState("en"); const [theme, setTheme] = useState("system"); const [toast, setToast] = useState(""); const [sheet, setSheet] = useState(false);
  const restoreFocus = useRef(null); const interestInput = useRef(null); const messages = catalog[locale]; const isRtl = directionFor(locale) === "rtl";
  useEffect(() => {
    const task = window.setTimeout(() => {
      const saved = parsePreferences(localStorage.getItem(PREFERENCE_KEY));
      setInterest(saved.interest); setSelected(new Set(saved.topics)); setLocale(saved.locale); setTheme(saved.theme);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = directionFor(locale); }, [locale]);
  useEffect(() => { document.documentElement.dataset.hydrated = "true"; return () => { delete document.documentElement.dataset.hydrated; }; }, []);
  useEffect(() => { if (step === 0 && restoreFocus.current) interestInput.current?.focus(); }, [step]);
  useEffect(() => { const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme; document.documentElement.dataset.theme = resolved; }, [theme]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 1800); return () => clearTimeout(timer); } }, [toast]);
  function save(next = {}) { localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ interest: interest.trim(), topics: [...selected], locale, theme, ...next })); }
  function go(next, focusRef) { restoreFocus.current = focusRef?.current ?? document.activeElement; setStep(next); requestAnimationFrame(() => document.querySelector("main input, main button")?.focus()); }
  function back(next) { setStep(next); }
  function chooseInterest(event) { event.preventDefault(); if (interest.trim()) go(1, interestInput); }
  function toggleTopic(topic) { setSelected((current) => { const next = new Set(current); next.has(topic) ? next.delete(topic) : next.add(topic); return next; }); }
  function openFeed() { if (!selected.size) { setToast(messages.empty); return; } save(); setStep(2); }
  return <AppShell feedMode={step === 2}>
    <main className={`journey ${isRtl ? "journey--rtl" : ""}`}>
      {step === 0 ? <section className="screen opening-screen" aria-labelledby="explore-title"><h1 id="explore-title">{messages.explore}</h1><form className="search-control" onSubmit={chooseInterest}><Search aria-hidden="true"/><label htmlFor="interest" className="sr-only">{messages.interest}</label><input ref={interestInput} id="interest" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder={messages.placeholder} dir="auto" maxLength={120}/><IconButton className="submit-control" type="submit" disabled={!interest.trim()} label={messages.continue}><ArrowRight className="directional-icon" aria-hidden="true"/></IconButton></form></section> : null}
      {step === 1 ? <section className="screen topic-screen" aria-label={messages.choose}><IconButton className="back-control" label={messages.back} onClick={() => back(0)}><ArrowLeft className="directional-icon" aria-hidden="true"/></IconButton><div className="topics">{TOPICS.map(([topic, Icon]) => <Chip key={topic} selected={selected.has(topic)} onClick={() => toggleTopic(topic)}>{selected.has(topic) ? <Check className="check" aria-hidden="true"/> : null}<Icon aria-hidden="true"/><span>{topic}</span></Chip>)}</div><IconButton className="build-control" label={`${messages.build}, ${formatItemCount(locale, selected.size)}`} onClick={openFeed} disabled={!selected.size}><ArrowRight className="directional-icon" aria-hidden="true"/></IconButton></section> : null}
      {step === 2 ? <section className="feed" aria-label={`${interest} feed`}><header className="feed-header"><IconButton label={messages.back} onClick={() => back(1)}><ArrowLeft className="directional-icon" aria-hidden="true"/></IconButton><strong dir="auto">{interest}</strong><IconButton label="Feed details" onClick={() => setSheet(true)}><Globe2 aria-hidden="true"/></IconButton></header>{CARDS.filter((card) => selected.has(card.topic)).map(({ Icon, ...card }) => <article className="feed-card" key={card.title} style={{ "--card-color": card.color }} tabIndex="0"><div className="feed-art"><Icon aria-hidden="true"/></div><div className="feed-content"><h2 dir="auto">{locale === "ar" ? card.original : card.title}</h2><span><span className="sr-only">{messages.source}: </span>{card.source}</span></div></article>)}</section> : null}
      <Sheet open={sheet} title={interest || "OpenScroll"} onClose={() => setSheet(false)}><p><bdi>{selected.size}</bdi> {messages.choose.toLowerCase()}</p></Sheet><Toast message={toast}/>
    </main>
  </AppShell>;
}
