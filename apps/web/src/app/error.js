"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }) {
  return (
    <main className="system-page">
      <p className="eyebrow">Something interrupted the quiet</p>
      <h1>OpenScroll could not finish that view.</h1>
      <p>Your local preferences have not been changed.</p>
      <button className="button button--primary" onClick={reset}>
        <RotateCcw size={18} aria-hidden="true" /> Try again
      </button>
    </main>
  );
}
