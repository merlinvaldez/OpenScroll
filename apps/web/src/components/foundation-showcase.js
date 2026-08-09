"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight, BookOpen, CheckCircle2, CircleAlert, Compass, Database,
  Globe2, Languages, Moon, Music2, Search, Settings2, Sparkles, Sun, Volume2
} from "lucide-react";

import AppShell from "./app-shell";
import { Button, Chip, Dialog, IconButton, Sheet, Skeleton, StateCard, Toast } from "./ui/primitives";

const copy = {
  en: {
    locale: "English", direction: "ltr", prompt: "What do you want to explore?",
    lead: "A calm foundation for the world’s open knowledge.", placeholder: "Try Morocco",
    topics: "Suggested directions", build: "Build Scroll", status: "Epic A foundation",
    statusBody: "The product shell, tokens, primitives, contracts, accessibility, and language foundation are working together.",
    dialogTitle: "A quiet dialog", dialogBody: "One decision at a time, with focus kept inside until you close it.",
    sheetTitle: "Foundation details", sheetBody: "This bottom sheet demonstrates progressive disclosure without competing with the main experience."
  },
  fr: {
    locale: "Français", direction: "ltr", prompt: "Que voulez-vous explorer ?",
    lead: "Une base calme pour les savoirs ouverts du monde.", placeholder: "Essayez Maroc",
    topics: "Pistes suggérées", build: "Créer le Scroll", status: "Fondation de l’épopée A",
    statusBody: "La structure, les jetons, les composants, les contrats, l’accessibilité et les langues fonctionnent ensemble.",
    dialogTitle: "Une fenêtre calme", dialogBody: "Une décision à la fois, avec le focus conservé jusqu’à la fermeture.",
    sheetTitle: "Détails de la fondation", sheetBody: "Cette feuille illustre la divulgation progressive sans rivaliser avec l’expérience principale."
  },
  ar: {
    locale: "العربية", direction: "rtl", prompt: "ماذا تريد أن تستكشف؟",
    lead: "أساس هادئ للمعرفة المفتوحة في العالم.", placeholder: "جرّب المغرب",
    topics: "مسارات مقترحة", build: "أنشئ التمرير", status: "أساس المرحلة الأولى",
    statusBody: "تعمل بنية المنتج والرموز والمكوّنات والعقود وإمكانية الوصول واللغات معًا.",
    dialogTitle: "نافذة هادئة", dialogBody: "قرار واحد في كل مرة، مع بقاء التركيز داخل النافذة حتى إغلاقها.",
    sheetTitle: "تفاصيل الأساس", sheetBody: "توضّح هذه اللوحة الإفصاح التدريجي دون منافسة التجربة الرئيسية."
  }
};

const topics = [
  ["Music", Music2], ["Darija", Languages], ["Architecture", Compass],
  ["History", BookOpen], ["Open data", Database], ["Culture", Globe2]
];

export default function FoundationShowcase() {
  const [theme, setTheme] = useState("light");
  const [locale, setLocale] = useState("en");
  const [selected, setSelected] = useState(new Set(["Music", "Darija", "History"]));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const dictionary = copy[locale];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("openscroll:theme");
    if (savedTheme !== "dark" && savedTheme !== "light") return undefined;
    const timeout = window.setTimeout(() => setTheme(savedTheme), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("openscroll:theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dictionary.direction;
  }, [locale, dictionary.direction]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function toggleTopic(topic) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  const actions = (
    <>
      <label className="locale-control">
        <Languages size={19} aria-hidden="true" />
        <span className="sr-only">Interface language</span>
        <select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label="Interface language">
          {Object.entries(copy).map(([key, value]) => <option value={key} key={key}>{value.locale}</option>)}
        </select>
      </label>
      <IconButton label={theme === "light" ? "Use dark theme" : "Use light theme"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      </IconButton>
      <IconButton label="Open foundation details" onClick={() => setSheetOpen(true)}>
        <Settings2 size={20} aria-hidden="true" />
      </IconButton>
    </>
  );

  return (
    <AppShell actions={actions}>
      <div className="foundation-page">
        <section className="hero" aria-labelledby="explore-heading">
          <div className="release-pill"><Sparkles size={15} aria-hidden="true" /> {dictionary.status}</div>
          <h1 id="explore-heading">{dictionary.prompt}</h1>
          <p className="hero__lead">{dictionary.lead}</p>
          <form className="interest-form" onSubmit={(event) => { event.preventDefault(); setToast("Interest ready to explore"); }}>
            <Search size={22} aria-hidden="true" />
            <label className="sr-only" htmlFor="interest">Interest</label>
            <input id="interest" name="interest" placeholder={dictionary.placeholder} defaultValue="Morocco" />
            <IconButton label="Explore interest" type="submit" className="interest-form__submit">
              <ArrowRight size={21} aria-hidden="true" />
            </IconButton>
          </form>
        </section>

        <section className="topic-section" aria-labelledby="topics-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Explicit choice</p>
              <h2 id="topics-heading">{dictionary.topics}</h2>
            </div>
            <span>{selected.size} selected</span>
          </div>
          <div className="chip-grid">
            {topics.map(([topic, Icon]) => (
              <Chip selected={selected.has(topic)} onClick={() => toggleTopic(topic)} key={topic}>
                <Icon size={17} aria-hidden="true" /> {topic}
              </Chip>
            ))}
          </div>
          <Button onClick={() => setToast("Scroll foundation created locally")}>
            {dictionary.build} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </section>

        <section className="foundation-grid" aria-label="Foundation components">
          <article className="foundation-card foundation-card--featured">
            <div className="card-icon"><CheckCircle2 size={24} aria-hidden="true" /></div>
            <p className="eyebrow">OS-001—OS-008</p>
            <h2>{dictionary.status}</h2>
            <p>{dictionary.statusBody}</p>
            <div className="button-row">
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
              <Button variant="quiet" onClick={() => setSheetOpen(true)}>Open sheet</Button>
            </div>
          </article>

          <article className="foundation-card">
            <div className="card-icon"><Volume2 size={24} aria-hidden="true" /></div>
            <p className="eyebrow">Accessible states</p>
            <h2>Loading, empty, and error</h2>
            <div className="skeleton-stack" aria-label="Loading preview">
              <Skeleton width="68%" /><Skeleton /><Skeleton width="44%" />
            </div>
            <StateCard icon={<CircleAlert size={22} />} title="Nothing open matched" message="Widen topics and try again." action={<Button variant="secondary">Widen topics</Button>} />
          </article>

          <article className="foundation-card foundation-card--tokens">
            <p className="eyebrow">Semantic tokens</p>
            <h2>Warm, quiet, readable</h2>
            <div className="swatches" aria-label="Core color tokens">
              {[
                ["Canvas", "var(--os-canvas)"], ["Surface", "var(--os-surface)"],
                ["Moss", "var(--os-moss)"], ["Ochre", "var(--os-ochre)"], ["Caution", "var(--os-caution)"]
              ].map(([name, color]) => (
                <div className="swatch" key={name}>
                  <span style={{ background: color }} aria-hidden="true" />
                  <small>{name}</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <footer className="foundation-footer">
          <Globe2 size={18} aria-hidden="true" />
          <span>Account-free · No user-generated content · WCAG 2.2 AA target · LTR + RTL</span>
        </footer>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={dictionary.dialogTitle} description={dictionary.dialogBody}>
        <div className="modal__content">
          <p>Native dialog semantics provide focus management, Escape handling, and a clear return to the triggering control.</p>
          <Button onClick={() => setDialogOpen(false)}>Done</Button>
        </div>
      </Dialog>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={dictionary.sheetTitle} description={dictionary.sheetBody}>
        <div className="modal__content detail-list">
          <p><strong>8</strong><span>Epic A tickets represented</span></p>
          <p><strong>3</strong><span>Interface languages</span></p>
          <p><strong>0</strong><span>Accounts or publishing flows</span></p>
        </div>
      </Sheet>

      <Toast message={toast} />
    </AppShell>
  );
}
