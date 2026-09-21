"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  Database,
  Globe2,
  Headphones,
  Info,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2
} from "lucide-react";
import { IconButton } from "./primitives";

export const MEDIA_STOP_EVENT = "openscroll:stop-media";
export const MEDIA_AUTOPLAY_EVENT = "openscroll:autoplay-media";

function CardFrame({ className, children, showChrome, onToggleChrome }) {

  function toggleChrome(event) {
    if (event.target.closest("button, a, input, select, textarea, summary")) return;
    onToggleChrome();
  }

  function handleKeyDown(event) {
    if (event.target.closest("button, a, input, select, textarea, summary")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleChrome();
  }

  return (
    <article
      className={`feed-card ${className} ${showChrome ? "" : "feed-card--chrome-hidden"}`}
      tabIndex="0"
      onClick={toggleChrome}
      onKeyDown={handleKeyDown}
    >
      {children}
    </article>
  );
}

export function sourceUrlForCard(card) {
  return card?.object?.identity?.sourceRecordUrl || card?.object?.identity?.originalSourceUrl || card?.object?.canonicalUrl || card?.downloadUrl;
}

export function ActionRail({ card, onWhyOpen, messages }) {
  const sourceUrl = sourceUrlForCard(card);

  return (
    <div className="card-rail" role="toolbar" aria-label="Card actions">
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="icon-control"
          aria-label={messages.openSourceFile}
          title={messages.openSourceFile}
        >
          <Globe2 aria-hidden="true" />
        </a>
      ) : null}

      <IconButton label={messages.whyOpen} onClick={() => onWhyOpen(card)}>
        <Info aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function ImageCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages, locale, showChrome, onToggleChrome }) {
  const imageUrl = card.object?.media?.url || card.downloadUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  return (
    <CardFrame className="feed-card--image" showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage image-stage">
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
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </CardFrame>
  );
}

function formatMediaTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function articleText(card) {
  const content = card.object?.content || {};
  return content.text || content.sections?.map((section) => section.content).filter(Boolean).join("\n\n") || content.description || "Open knowledge overview and verified archival documentation.";
}

function articleExcerpt(text, maxLength = 460) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText.length <= maxLength) return cleanText;
  const boundary = cleanText.slice(0, maxLength).lastIndexOf(" ");
  return `${cleanText.slice(0, boundary > 0 ? boundary : maxLength).trim()}…`;
}

export function AudioCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale, showChrome, onToggleChrome }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(card.object?.media?.durationSeconds || 0);
  const audioRef = useRef(null);
  const audioVisibleRef = useRef(false);
  const media = card.object?.media || {};
  const audioUrl = media.url || card.downloadUrl;
  const thumbnailUrl = media.thumbnailUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  useEffect(() => {
    setIsPlaying(false);
    setMediaError(false);
    setThumbnailFailed(false);
    setCurrentTime(0);
    setDuration(media.durationSeconds || 0);
    return () => audioRef.current?.pause();
  }, [audioUrl, media.durationSeconds]);

  useEffect(() => {
    function stopPlayback() {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }

    window.addEventListener(MEDIA_STOP_EVENT, stopPlayback);
    return () => window.removeEventListener(MEDIA_STOP_EVENT, stopPlayback);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const cardElement = audio?.closest(".feed-card");
    const feedElement = cardElement?.closest(".feed");
    if (!audio || !cardElement || !feedElement || typeof IntersectionObserver === "undefined") return undefined;

    const playIfVisible = async () => {
      if (!audioVisibleRef.current || mediaError) return;
      audio.muted = false;
      try {
        await audio.play();
        if (!audio.paused) setIsPlaying(true);
      } catch {
        // Browsers may require a user gesture before allowing audible autoplay.
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
        audioVisibleRef.current = isVisible;

        if (isVisible) {
          playIfVisible();
        } else {
          audio.pause();
          audio.currentTime = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        }
      },
      { root: feedElement, threshold: [0, 0.65] }
    );

    window.addEventListener(MEDIA_AUTOPLAY_EVENT, playIfVisible);
    observer.observe(cardElement);

    return () => {
      window.removeEventListener(MEDIA_AUTOPLAY_EVENT, playIfVisible);
      observer.disconnect();
      audioVisibleRef.current = false;
    };
  }, [audioUrl, mediaError]);

  async function togglePlay(event) {
    event?.stopPropagation();
    const audio = audioRef.current;
    if (!audio || mediaError) return;

    if (audio.paused) {
      audio.muted = false;
      try {
        await audio.play();
        onToggleChrome();
      } catch {
        setMediaError(true);
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      onToggleChrome();
    }
  }

  return (
    <CardFrame className="feed-card--audio" showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage audio-stage">
        <button
          type="button"
          className={`audio-artwork ${thumbnailUrl && !thumbnailFailed ? "" : "audio-artwork--fallback"}`}
          onClick={togglePlay}
          aria-label={isPlaying ? messages.pauseAudio : messages.playAudio}
        >
          {thumbnailUrl && !thumbnailFailed ? (
            <img
              className="audio-thumbnail"
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              onError={() => setThumbnailFailed(true)}
            />
          ) : (
            <Music className="audio-fallback-icon" size={48} aria-hidden="true" />
          )}
          <div className={`audio-visualizer ${thumbnailUrl && !thumbnailFailed ? "audio-visualizer--overlay" : ""}`} aria-hidden="true">
            <div className={`waveform ${isPlaying ? "waveform--active" : ""}`}>
              {[40, 65, 30, 85, 95, 45, 70, 60, 90, 40, 75, 55, 80, 100, 50, 70, 35, 85, 60, 45].map((h, i) => (
                <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
          </div>
        </button>

        <audio
          ref={audioRef}
          className="media-audio"
          src={audioUrl || undefined}
          preload="metadata"
          aria-hidden="true"
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onError={() => {
            setMediaError(true);
            setIsPlaying(false);
          }}
        />

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
            <span className="audio-time">{formatMediaTime(currentTime)} / {formatMediaTime(duration)}</span>
            <span className="audio-badge">{mediaError ? messages.mediaUnavailable : messages.playAudio}</span>
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
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </CardFrame>
  );
}

export function VideoCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages, locale, showChrome, onToggleChrome }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const videoRef = useRef(null);
  const videoVisibleRef = useRef(false);
  const media = card.object?.media || {};
  const videoUrl = media.url || card.downloadUrl;
  const thumbnailUrl = media.thumbnailUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  useEffect(() => {
    setIsPlaying(false);
    setMediaError(false);
    videoVisibleRef.current = false;
    return () => videoRef.current?.pause();
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return undefined;

    const playIfVisible = async () => {
      if (!videoVisibleRef.current || mediaError) return;
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
        if (!video.paused) setIsPlaying(true);
      } catch {
        // Keep the video paused when the browser blocks audible autoplay; never start it silently.
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.65;
        videoVisibleRef.current = isVisible;

        if (isVisible) {
          playIfVisible();
        } else {
          video.pause();
          video.currentTime = 0;
          setIsPlaying(false);
        }
      },
      { root: video.closest(".feed"), threshold: [0, 0.65] }
    );

    window.addEventListener(MEDIA_AUTOPLAY_EVENT, playIfVisible);
    observer.observe(video);

    return () => {
      window.removeEventListener(MEDIA_AUTOPLAY_EVENT, playIfVisible);
      observer.disconnect();
      videoVisibleRef.current = false;
    };
  }, [videoUrl, mediaError]);

  useEffect(() => {
    function stopPlayback() {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
    }

    window.addEventListener(MEDIA_STOP_EVENT, stopPlayback);
    return () => window.removeEventListener(MEDIA_STOP_EVENT, stopPlayback);
  }, []);

  async function togglePlay(event) {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video || mediaError) return;

    if (video.paused) {
      video.muted = false;
      video.volume = 1;
      try {
        await video.play();
        if (!video.paused) setIsPlaying(true);
        onToggleChrome();
      } catch {
        setMediaError(true);
        setIsPlaying(false);
      }
    } else {
      if (video.muted) {
        video.muted = false;
        video.volume = 1;
        try {
          await video.play();
          if (!video.paused) setIsPlaying(true);
        } catch {
          // A user gesture normally unlocks audio; keep the media state recoverable if it does not.
        }
        onToggleChrome();
        return;
      }
      video.pause();
      onToggleChrome();
    }
  }

  return (
    <CardFrame className={`feed-card--video ${isPlaying ? "feed-card--playing" : ""}`} showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage video-stage">
        <video
          ref={videoRef}
          className="stage-video"
          src={videoUrl || undefined}
          poster={thumbnailUrl || undefined}
          preload="metadata"
          playsInline
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setMediaError(true);
            setIsPlaying(false);
          }}
        />
        {!isPlaying ? (
          <button
            type="button"
            className="video-play-btn"
            onClick={togglePlay}
            aria-label={messages.playVideo}
            disabled={mediaError}
          >
            <Play size={28} aria-hidden="true" />
          </button>
        ) : null}
        {mediaError ? <p className="media-error">{messages.mediaUnavailable}</p> : null}
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
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </CardFrame>
  );
}

export function ReaderCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, onOpenViewer, messages, locale, showChrome, onToggleChrome }) {
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;
  const isPrimarySource = card.object?.content?.type === "source-text";
  const excerpt = articleExcerpt(articleText(card));

  return (
    <CardFrame className="feed-card--reader" showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage reader-stage">
        <div className="reader-excerpt-box">
          <h2 className="reader-card-title" dir="auto">{displayTitle}</h2>
          {isPrimarySource ? (
            <span className="primary-source-tag">{messages.primarySource}</span>
          ) : null}
          <p className="reader-text" dir="auto">
            {excerpt}
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
    </CardFrame>
  );
}

export function MapCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages, locale, showChrome, onToggleChrome }) {
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;
  const place = card.object?.geography?.places?.[0]?.label || "Morocco";

  return (
    <CardFrame className="feed-card--map" showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage map-stage">
        <div className="map-mock-canvas">
          <div className="map-grid-lines" aria-hidden="true" />
          <div className="map-pin">
            <Compass size={24} className="pin-icon" aria-hidden="true" />
            <span className="pin-label">{place}</span>
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
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </CardFrame>
  );
}

export function MuseumCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages, locale, showChrome, onToggleChrome }) {
  const imageUrl = card.object?.media?.url || card.downloadUrl;
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  return (
    <CardFrame className="feed-card--museum" showChrome={showChrome} onToggleChrome={onToggleChrome}>
      <div className="media-stage museum-stage">
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
        <h2 dir="auto">{displayTitle}</h2>
      </div>
    </CardFrame>
  );
}

export function SessionBreathingCard({ exploredCount = 25, sourceCount = 6, onContinue, onPause, messages, showChrome, onToggleChrome }) {
  return (
    <CardFrame className="feed-card--breathing" showChrome={showChrome} onToggleChrome={onToggleChrome}>
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
    </CardFrame>
  );
}

export function UniversalCard(props) {
  const contentKind = props.card.object?.content?.type;
  const mediaKind = props.card.object?.media?.kind;
  const readerKinds = ["article", "reader", "source-text", "dictionary", "travel-guide", "text"];
  const kind = readerKinds.includes(contentKind) ? "reader" : contentKind === "museum-object" || contentKind === "map" ? contentKind : mediaKind || contentKind || "article";

  switch (kind) {
    case "image":
      return <ImageCard {...props} />;
    case "audio":
      return <AudioCard {...props} />;
    case "video":
      return <VideoCard {...props} />;
    case "museum-object":
      return <MuseumCard {...props} />;
    case "map":
      return <MapCard {...props} />;
    case "article":
    case "reader":
    case "source-text":
    case "dictionary":
    case "travel-guide":
    case "text":
    default:
      return <ReaderCard {...props} />;
  }
}
