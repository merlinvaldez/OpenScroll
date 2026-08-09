"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Compass, Database, Globe2,
  Languages, Music2, Search
} from "lucide-react";

const TOPICS = [
  ["Music", Music2],
  ["Darija", Languages],
  ["Architecture", Compass],
  ["History", BookOpen],
  ["Open data", Database],
  ["Culture", Globe2],
];

const CARDS = [
  { type: "MUSIC", title: "The living pulse of Gnawa", source: "Wikimedia Commons", color: "#415f4a" },
  { type: "LANGUAGE", title: "Darija, written and spoken", source: "Wiktionary", color: "#c66c3b" },
  { type: "HISTORY", title: "A brief history of the medina", source: "OpenStreetMap", color: "#697b8e" },
];

export default function FoundationShowcase() {
  const [step, setStep] = useState(0);
  const [interest, setInterest] = useState("");
  const [selected, setSelected] = useState(new Set(["Music", "Darija", "History"]));

  useEffect(() => {
    const saved = window.localStorage.getItem("openscroll:preferences");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (typeof data.interest === "string") setInterest(data.interest);
      if (Array.isArray(data.topics)) setSelected(new Set(data.topics));
    } catch {}
  }, []);

  function chooseInterest(event) {
    event.preventDefault();
    if (interest.trim()) setStep(1);
  }

  function toggleTopic(topic) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }

  function openFeed() {
    window.localStorage.setItem("openscroll:preferences", JSON.stringify({
      interest: interest.trim(),
      topics: [...selected],
    }));
    setStep(2);
  }

  return (
    <main className="journey">
      <style jsx global>{`
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        html, body { min-height: 100%; margin: 0; }
        body { background: #f5f1e8; color: #1e2821; font-family: Arial, Helvetica, sans-serif; }
        button, input { font: inherit; }
        button { color: inherit; }
        .journey { min-height: 100vh; }
        .screen { min-height: 100vh; display: grid; align-content: center; width: min(100% - 36px, 760px); margin: auto; padding: 48px 0; }
        .screen--feed { align-content: start; width: min(100% - 28px, 540px); }
        .mark { position: fixed; top: 24px; left: 24px; display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #738474; border-radius: 50%; font: italic 21px Georgia, serif; color: #34553e; }
        h1 { margin: 0 0 42px; text-align: center; font: 400 clamp(42px, 8vw, 72px)/.98 Georgia, serif; letter-spacing: -.055em; }
        .search { display: flex; align-items: center; gap: 12px; width: min(100%, 620px); margin: auto; padding: 10px 10px 10px 20px; border: 1px solid #cfc8b8; border-radius: 999px; background: #fffdf8; box-shadow: 0 18px 60px rgb(40 50 42 / 8%); }
        .search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; font-size: 18px; }
        .circle-button { display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border: 0; border-radius: 50%; background: #34553e; color: white; cursor: pointer; }
        .circle-button:disabled { opacity: .35; cursor: default; }
        .back { position: fixed; top: 24px; right: 24px; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
        .topics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .topic { position: relative; display: grid; place-items: center; gap: 16px; min-height: 150px; padding: 22px 12px; border: 1px solid #d4ccbb; border-radius: 24px; background: #fffdf8; cursor: pointer; }
        .topic[aria-pressed="true"] { border-color: #34553e; background: #e3eadf; }
        .topic .check { position: absolute; top: 12px; right: 12px; }
        .topic span { font-size: 15px; }
        .continue { display: grid; place-items: center; width: 58px; height: 58px; margin: 34px auto 0; padding: 0; border: 0; border-radius: 50%; background: #34553e; color: white; cursor: pointer; }
        .continue:disabled { opacity: .35; }
        .feed-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 20px 0 16px; background: linear-gradient(#f5f1e8 72%, transparent); }
        .feed-head strong { font: 400 28px Georgia, serif; }
        .feed-card { overflow: hidden; margin-bottom: 18px; border: 1px solid #d4ccbb; border-radius: 28px; background: #fffdf8; }
        .feed-art { display: grid; place-items: center; aspect-ratio: 4/3; color: white; }
        .feed-card-content { padding: 22px; }
        .feed-type { margin: 0 0 8px; color: #68766b; font-size: 11px; font-weight: 700; letter-spacing: .14em; }
        .feed-card h2 { margin: 0 0 18px; font: 400 30px/1.08 Georgia, serif; letter-spacing: -.03em; }
        .feed-source { color: #68766b; font-size: 13px; }
        @media (max-width: 620px) {
          .topics { grid-template-columns: repeat(2, 1fr); }
          .topic { min-height: 132px; }
          h1 { margin-bottom: 34px; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .screen { animation: enter .32s ease both; }
          @keyframes enter { from { opacity: 0; transform: translateY(10px); } }
        }
        :focus-visible { outline: 3px solid #c66c3b; outline-offset: 3px; }
      `}</style>

      <span className="mark" aria-label="OpenScroll">O</span>

      {step === 0 && (
        <section className="screen" aria-labelledby="explore-title">
          <h1 id="explore-title">What do you want to explore?</h1>
          <form className="search" onSubmit={chooseInterest}>
            <Search size={22} aria-hidden="true" />
            <label htmlFor="interest" className="sr-only">Interest</label>
            <input
              id="interest"
              autoFocus
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              placeholder="Morocco"
            />
            <button className="circle-button" type="submit" disabled={!interest.trim()} aria-label="Continue">
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {step === 1 && (
        <section className="screen" aria-label="Choose topics">
          <button className="back" onClick={() => setStep(0)} aria-label="Back">
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="topics">
            {TOPICS.map(([topic, Icon]) => (
              <button className="topic" aria-pressed={selected.has(topic)} onClick={() => toggleTopic(topic)} key={topic}>
                {selected.has(topic) && <Check className="check" size={18} aria-hidden="true" />}
                <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
                <span>{topic}</span>
              </button>
            ))}
          </div>
          <button className="continue" onClick={openFeed} disabled={!selected.size} aria-label="Build feed">
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="screen screen--feed" aria-label={`${interest} feed`}>
          <header className="feed-head">
            <button className="back" style={{ position: "static" }} onClick={() => setStep(1)} aria-label="Back">
              <ArrowLeft aria-hidden="true" />
            </button>
            <strong>{interest}</strong>
            <span aria-hidden="true" style={{ width: 44 }} />
          </header>
          {CARDS.filter((card) => selected.has(card.type[0] + card.type.slice(1).toLowerCase()) || card.type === "LANGUAGE").map((card, index) => (
            <article className="feed-card" key={card.title}>
              <div className="feed-art" style={{ background: card.color }}>
                {index === 0 ? <Music2 size={64} strokeWidth={1.2} /> : index === 1 ? <Languages size={64} strokeWidth={1.2} /> : <BookOpen size={64} strokeWidth={1.2} />}
              </div>
              <div className="feed-card-content">
                <p className="feed-type">{card.type}</p>
                <h2>{card.title}</h2>
                <span className="feed-source">{card.source}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
