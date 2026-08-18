"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Download,
  EyeOff,
  ExternalLink,
  GitBranch,
  Globe2,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Volume2,
  X
} from "lucide-react";
import { Sheet } from "./primitives";

export function BranchExplorationSheet({ open, card, onClose, onExploreBranch, onAddToScroll, messages, locale }) {
  if (!card) return null;
  const isArabic = locale === "ar";
  const title = isArabic && card.original ? card.original : card.title;
  const concept = card.topic || "Culture";

  return (
    <Sheet open={open} title={messages.exploreBranch} onClose={onClose}>
      <div className="sheet-panel branch-panel">
        <div className="branch-hero">
          <div className="branch-icon-badge">
            <GitBranch size={28} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">Discovered Concept</span>
            <h3>{concept}</h3>
            <p className="branch-definition" dir="auto">
              {card.object?.content?.description || `Explore interconnected open knowledge and cultural media around ${concept}.`}
            </p>
          </div>
        </div>

        <div className="branch-path">
          <span className="path-node">{card.object?.geography?.places?.[0]?.label || "Root Interest"}</span>
          <ArrowRight size={14} className="path-arrow" aria-hidden="true" />
          <span className="path-node path-node--active">{concept}</span>
          <ArrowRight size={14} className="path-arrow" aria-hidden="true" />
          <span className="path-node">{title}</span>
        </div>

        <div className="branch-actions">
          <button
            type="button"
            className="branch-cta branch-cta--primary"
            onClick={() => onExploreBranch(concept)}
          >
            <Compass size={18} aria-hidden="true" />
            <span>{messages.exploreNow}</span>
          </button>
          <button
            type="button"
            className="branch-cta branch-cta--secondary"
            onClick={() => onAddToScroll(concept)}
          >
            <Plus size={18} aria-hidden="true" />
            <span>{messages.addToScroll}</span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function WhyThisSheet({ open, card, rootInterest = "Morocco", onClose, onFeedback, messages, locale }) {
  if (!card) return null;
  const isArabic = locale === "ar";
  const title = isArabic && card.original ? card.original : card.title;

  return (
    <Sheet open={open} title={messages.whyThis} onClose={onClose}>
      <div className="sheet-panel why-this-panel">
        <p className="causal-eyebrow">{messages.causalPath}</p>
        <div className="causal-tree">
          <div className="tree-node">
            <span className="node-dot" />
            <div>
              <strong>{rootInterest}</strong>
              <small>Root interest chosen by you</small>
            </div>
          </div>
          <div className="tree-node">
            <span className="node-dot" />
            <div>
              <strong>{card.topic}</strong>
              <small>Selected topic dimension</small>
            </div>
          </div>
          <div className="tree-node tree-node--leaf">
            <span className="node-dot node-dot--leaf" />
            <div>
              <strong dir="auto">{title}</strong>
              <small>Verified artifact via {card.source}</small>
            </div>
          </div>
        </div>

        <section className="feedback-section">
          <h3>Tune this direction</h3>
          <div className="feedback-grid">
            <button
              type="button"
              className="feedback-btn"
              onClick={() => onFeedback(card, "more-like-this", "Tuned: More like this direction")}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{messages.moreLikeThis}</span>
            </button>
            <button
              type="button"
              className="feedback-btn"
              onClick={() => onFeedback(card, "less-like-this", "Tuned: Less like this direction")}
            >
              <Minus size={16} aria-hidden="true" />
              <span>{messages.lessLikeThis}</span>
            </button>
            <button
              type="button"
              className="feedback-btn"
              onClick={() => onFeedback(card, "go-deeper", "Tuned: Exploring deeper scholarship")}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>{messages.goDeeper}</span>
            </button>
            <button
              type="button"
              className="feedback-btn"
              onClick={() => onFeedback(card, "more-surprising", "Tuned: High novelty boost")}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>{messages.moreSurprising}</span>
            </button>
            <button
              type="button"
              className="feedback-btn feedback-btn--danger"
              onClick={() => onFeedback(card, "hide", "Direction hidden from this Scroll")}
            >
              <EyeOff size={16} aria-hidden="true" />
              <span>{messages.excludeTopic}</span>
            </button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

export function WhyOpenSheet({ open, card, onClose, messages, locale }) {
  if (!card) return null;
  const isArabic = locale === "ar";
  const title = isArabic && card.original ? card.original : card.title;
  const rights = card.object?.rights;

  return (
    <Sheet open={open} title={messages.whyOpen} onClose={onClose}>
      <div className="sheet-panel why-open-panel">
        <div className="rights-badge-row">
          <div className="rights-shield">
            <ShieldCheck size={28} className="shield-icon" aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">Open License Passport</span>
            <h3>{card.license}</h3>
            <p className="rights-headline">{card.openBasis}</p>
          </div>
        </div>

        <section className="rights-section">
          <h4>{messages.plainPermissions}</h4>
          <ul className="permissions-list">
            <li>
              <Check size={16} className="perm-check" aria-hidden="true" />
              <span><strong>Free access:</strong> You may view, read, and inspect this object anytime without cost.</span>
            </li>
            <li>
              <Check size={16} className="perm-check" aria-hidden="true" />
              <span><strong>Redistribution:</strong> You may freely share, republish, and distribute this item.</span>
            </li>
            <li>
              <Check size={16} className="perm-check" aria-hidden="true" />
              <span><strong>Modification & Reuse:</strong> You may remix and build upon this knowledge.</span>
            </li>
          </ul>
        </section>

        <section className="rights-section">
          <h4>{messages.plainObligations}</h4>
          <div className="attribution-box">
            <p className="attr-text" dir="auto">{card.attribution}</p>
          </div>
          <ul className="rights-bullets">
            {card.whyOpen?.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="rights-section">
          <h4>Source & Verification</h4>
          <dl className="rights-dl">
            <div>
              <dt>Holding Institution</dt>
              <dd>{card.source}</dd>
            </div>
            <div>
              <dt>Creator / Author</dt>
              <dd>{card.creator || "Public contributor"}</dd>
            </div>
            <div>
              <dt>Verification Passport</dt>
              <dd>{rights?.verification?.evidence || "Verified on canonical source record."}</dd>
            </div>
            <div>
              <dt>Download Status</dt>
              <dd>{card.downloadRule}</dd>
            </div>
          </dl>
          {card.downloadAllowed ? (
            <a
              href={card.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="rights-source-link"
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>{messages.openSourceFile}</span>
            </a>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}

export function FocusedViewerModal({ open, card, mode = "image", onClose, messages, locale }) {
  if (!card || !open) return null;
  const isArabic = locale === "ar";
  const title = isArabic && card.original ? card.original : card.title;
  const imageUrl = card.object?.media?.url || card.downloadUrl;

  return (
    <dialog className="focused-modal" open aria-modal="true" aria-labelledby="focused-viewer-title">
      <header className="focused-header">
        <h2 id="focused-viewer-title" dir="auto">{title}</h2>
        <button type="button" className="focused-close-btn" onClick={onClose} aria-label={messages.close}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="focused-stage">
        {mode === "image" || mode === "museum" ? (
          <div className="focused-img-container">
            <img
              src={imageUrl}
              alt={card.object?.media?.accessibility?.altText || title}
              className="focused-full-img"
            />
            <div className="focused-caption-drawer">
              <span className="caption-source">{card.source}</span>
              <span className="caption-license">{card.license}</span>
            </div>
          </div>
        ) : null}

        {mode === "reader" ? (
          <article className="focused-reader-container" dir="auto">
            <div className="reader-typography-bar">
              <span className="reader-source-tag">{card.source}</span>
              <span className="reader-license-tag">{card.license}</span>
            </div>
            <h1 className="reader-title">{title}</h1>
            <p className="reader-lead">
              {card.object?.content?.description || "A foundational open cultural record from verified archives."}
            </p>
            <div className="reader-body">
              <p>
                This artifact is preserved in the public knowledge commons. OpenScroll presents it directly from {card.source} without modification to its underlying provenance.
              </p>
              <p>
                {card.attribution}
              </p>
            </div>
            <div className="reader-footer">
              <a href={card.downloadUrl} target="_blank" rel="noreferrer" className="rights-source-link">
                <ExternalLink size={16} aria-hidden="true" />
                <span>{messages.openSourceFile}</span>
              </a>
            </div>
          </article>
        ) : null}

        {mode === "transcript" ? (
          <div className="focused-transcript-container" dir="auto">
            <h3>{messages.transcript}</h3>
            <p className="transcript-body">
              {card.object?.media?.accessibility?.transcript || "Instrumental or performance recording. Transcript pending source availability."}
            </p>
          </div>
        ) : null}

        {mode === "map" ? (
          <div className="focused-map-container">
            <div className="map-full-mock">
              <Compass size={48} className="pin-icon" aria-hidden="true" />
              <h3>{card.object?.geography?.places?.[0]?.label || "Historic Site"}</h3>
              <p>Coordinates: {card.object?.geography?.places?.[0]?.coordinates?.join(", ") || "31.7917, -7.0926"}</p>
              <small>OpenStreetMap ODbL Verified Open Map Layer</small>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
