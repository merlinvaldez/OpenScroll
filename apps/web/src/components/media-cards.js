"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Compass,
  Database,
  ExternalLink,
  GitBranch,
  Globe2,
  Headphones,
  HelpCircle,
  Info,
  Maximize2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2
} from "lucide-react";
import { IconButton } from "./primitives";

export function ActionRail({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages }) {
  return (
    <div className="card-rail" role="toolbar" aria-label="Card actions">
      <IconButton
        aria-pressed={saved}
        label={saved ? messages.removeSave : messages.saveItem}
        onClick={() => onToggleSave(card)}
        className={saved ? "rail-btn--active" : ""}
      >
        {saved ? <BookmarkCheck className="icon-saved" aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      </IconButton>

      <IconButton label={messages.exploreBranch} onClick={() => onBranch(card)}>
        <GitBranch aria-hidden="true" />
      </IconButton>

      <IconButton label={messages.whyThis} onClick={() => onWhyThis(card)}>
        <HelpCircle aria-hidden="true" />
      </IconButton>

      <IconButton label={messages.whyOpen} onClick={() => onWhyOpen(card)}>
        <Info aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function MetadataRow({ card, messages, locale }) {
  return (
    <div className="meta-row">
      {card.topic ? (
        <>
          <span className="mindmap-topic-badge" title={`Semantic match: ${card.topic}`}>
            ✦ {card.topic}
          </span>
          <span className="meta-separator" aria-hidden="true">•</span>
        </>
      ) : null}
      <span className="meta-source" title={card.source}>
        <span className="sr-only">{messages.source}: </span>
        {card.source}
      </span>
      <span className="meta-separator" aria-hidden="true">•</span>
      <span className="meta-license" title={card.license}>
        {card.license}
      </span>
      {card.creator ? (
        <>
          <span className="meta-separator" aria-hidden="true">•</span>
          <span className="meta-creator" title={card.creator}>
            {card.creator}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function ImageCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale }) {
  const imageUrl = card.object?.media?.url || card.downloadUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  return (
    <article className="feed-card feed-card--image" tabIndex="0">
      <div className="media-stage image-stage" onClick={() => onOpenViewer(card, "image")}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.object?.media?.accessibility?.altText || displayTitle}
            className="stage-img"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.classList.add("media-fallback-active");
            }}
          />
        ) : null}
        <div className="image-fallback">
          <Globe2 className="fallback-icon" aria-hidden="true" />
          <span>{card.topic}</span>
        </div>
        <button
          type="button"
          className="stage-zoom-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenViewer(card, "image");
          }}
          aria-label={messages.zoomImage}
        >
          <Maximize2 size={18} aria-hidden="true" />
        </button>
      </div>

      <ActionRail
        card={card}
        saved={saved}
        onToggleSave={onToggleSave}
        onWhyThis={onWhyThis}
        onWhyOpen={onWhyOpen}
        onBranch={onBranch}
        messages={messages}
      />

      <div className="feed-content">
        <MetadataRow card={card} messages={messages} locale={locale} />
        <h2 dir="auto">{displayTitle}</h2>
        {card.object?.content?.description ? (
          <p className="feed-description" dir="auto">
            {card.object.content.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function AudioCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;
  const duration = card.object?.media?.durationSeconds || 96;

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        // Fallback for simulated playback
        setIsPlaying(true);
      });
      setIsPlaying(true);
    }
  }

  return (
    <article className="feed-card feed-card--audio" tabIndex="0">
      <div className="media-stage audio-stage">
        <div className="audio-visualizer" aria-hidden="true">
          <div className={`waveform ${isPlaying ? "waveform--active" : ""}`}>
            {[40, 65, 30, 85, 95, 45, 70, 60, 90, 40, 75, 55, 80, 100, 50, 70, 35, 85, 60, 45].map((h, i) => (
              <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        </div>

        <div className="audio-transport">
          <button
            type="button"
            className="transport-play-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? messages.pauseAudio : messages.playAudio}
          >
            {isPlaying ? <Pause size={28} aria-hidden="true" /> : <Play size={28} aria-hidden="true" />}
          </button>
          <div className="transport-info">
            <span className="audio-time">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}</span>
            <span className="audio-badge">{messages.playAudio}</span>
          </div>
          {card.object?.media?.accessibility?.transcript ? (
            <button
              type="button"
              className="transport-transcript-btn"
              onClick={() => onOpenViewer(card, "transcript")}
              aria-label={messages.transcript}
            >
              <Headphones size={18} aria-hidden="true" />
              <span>{messages.transcript}</span>
            </button>
          ) : null}
        </div>
      </div>

      <ActionRail
        card={card}
        saved={saved}
        onToggleSave={onToggleSave}
        onWhyThis={onWhyThis}
        onWhyOpen={onWhyOpen}
        onBranch={onBranch}
        messages={messages}
      />

      <div className="feed-content">
        <MetadataRow card={card} messages={messages} locale={locale} />
        <h2 dir="auto">{displayTitle}</h2>
        {card.object?.content?.description ? (
          <p className="feed-description" dir="auto">
            {card.object.content.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ReaderCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale }) {
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;
  const isPrimarySource = card.object?.content?.type === "source-text";

  return (
    <article className="feed-card feed-card--reader" tabIndex="0">
      <div className="media-stage reader-stage" onClick={() => onOpenViewer(card, "reader")}>
        <div className="reader-excerpt-box">
          {isPrimarySource ? (
            <span className="primary-source-tag">{messages.primarySource}</span>
          ) : null}
          <div className="reader-icon-row" aria-hidden="true">
            <BookOpen size={28} />
          </div>
          <p className="reader-text" dir="auto">
            {card.object?.content?.description || "Open knowledge overview and verified archival documentation."}
          </p>
          <div className="reader-action-row">
            <button
              type="button"
              className="read-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer(card, "reader");
              }}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>{messages.readArticle}</span>
            </button>
            <span className="reading-time">3 {messages.readingTime}</span>
          </div>
        </div>
      </div>

      <ActionRail
        card={card}
        saved={saved}
        onToggleSave={onToggleSave}
        onWhyThis={onWhyThis}
        onWhyOpen={onWhyOpen}
        onBranch={onBranch}
        messages={messages}
      />

      <div className="feed-content">
        <MetadataRow card={card} messages={messages} locale={locale} />
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </article>
  );
}

export function MapCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale }) {
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;
  const place = card.object?.geography?.places?.[0]?.label || "Morocco";

  return (
    <article className="feed-card feed-card--map" tabIndex="0">
      <div className="media-stage map-stage" onClick={() => onOpenViewer(card, "map")}>
        <div className="map-mock-canvas">
          <div className="map-grid-lines" aria-hidden="true" />
          <div className="map-pin">
            <Compass size={24} className="pin-icon" aria-hidden="true" />
            <span className="pin-label">{place}</span>
          </div>
        </div>
        <button
          type="button"
          className="stage-zoom-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenViewer(card, "map");
          }}
          aria-label={messages.exploreMap}
        >
          <Maximize2 size={18} aria-hidden="true" />
        </button>
      </div>

      <ActionRail
        card={card}
        saved={saved}
        onToggleSave={onToggleSave}
        onWhyThis={onWhyThis}
        onWhyOpen={onWhyOpen}
        onBranch={onBranch}
        messages={messages}
      />

      <div className="feed-content">
        <MetadataRow card={card} messages={messages} locale={locale} />
        <h2 dir="auto">{displayTitle}</h2>
        {card.object?.content?.description ? (
          <p className="feed-description" dir="auto">
            {card.object.content.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function MuseumCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale }) {
  const imageUrl = card.object?.media?.url || card.downloadUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  return (
    <article className="feed-card feed-card--museum" tabIndex="0">
      <div className="media-stage museum-stage" onClick={() => onOpenViewer(card, "museum")}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.object?.media?.accessibility?.altText || displayTitle}
            className="museum-img"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.classList.add("media-fallback-active");
            }}
          />
        ) : null}
        <div className="museum-pedestal">
          <span className="pedestal-tag">{card.object?.knowledge?.collection || "Smithsonian Collection"}</span>
        </div>
      </div>

      <ActionRail
        card={card}
        saved={saved}
        onToggleSave={onToggleSave}
        onWhyThis={onWhyThis}
        onWhyOpen={onWhyOpen}
        onBranch={onBranch}
        messages={messages}
      />

      <div className="feed-content">
        <MetadataRow card={card} messages={messages} locale={locale} />
        <h2 dir="auto">{displayTitle}</h2>
        {card.object?.content?.description ? (
          <p className="feed-description" dir="auto">
            {card.object.content.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function SessionBreathingCard({ exploredCount = 25, sourceCount = 6, onContinue, onPause, messages }) {
  return (
    <article className="feed-card feed-card--breathing" tabIndex="0">
      <div className="breathing-stage">
        <div className="breathing-circle" aria-hidden="true" />
        <div className="breathing-content">
          <p className="breathing-eyebrow">Humane Session Marker</p>
          <h2>You explored {exploredCount} objects across {sourceCount} open sources.</h2>
          <p className="breathing-prompt">Take a peaceful breath. Pause here or continue exploring when you are ready.</p>
          <div className="breathing-actions">
            <button type="button" className="breathing-btn breathing-btn--secondary" onClick={onPause}>
              <Pause size={18} aria-hidden="true" />
              <span>{messages.pauseSession}</span>
            </button>
            <button type="button" className="breathing-btn breathing-btn--primary" onClick={onContinue}>
              <Play size={18} aria-hidden="true" />
              <span>{messages.continueScroll}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function UniversalCard(props) {
  const kind = props.card.object?.media?.kind || props.card.object?.content?.type || "article";

  switch (kind) {
    case "image":
      return <ImageCard {...props} />;
    case "audio":
      return <AudioCard {...props} />;
    case "museum-object":
      return <MuseumCard {...props} />;
    case "map":
      return <MapCard {...props} />;
    case "article":
    case "source-text":
    case "dictionary":
    case "travel-guide":
    default:
      return <ReaderCard {...props} />;
  }
}
