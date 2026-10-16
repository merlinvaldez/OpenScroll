"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  Globe2,
  Headphones,
  Info,
  Music,
  Pause,
  Play,
  Volume2,
  VolumeX
} from "lucide-react";
import { IconButton } from "./primitives";

export const MEDIA_STOP_EVENT = "openscroll:stop-media";
export const MEDIA_AUTOPLAY_EVENT = "openscroll:autoplay-media";

export const ChromeContext = createContext({
  isChromeHidden: false,
  fadedOut: false,
  manualHidden: false,
  revealChrome: () => {},
  hideChrome: () => {}
});

function CardFrame({
  className = "",
  children,
  showChrome = true,
  _onToggleChrome,
  autoFade = true,
  isPaused = false
}) {
  const [fadedOut, setFadedOut] = useState(false);
  const [manualHidden, setManualHidden] = useState(false);
  const cardRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const isIntersectingRef = useRef(false);

  const revealChrome = () => {
    setFadedOut(false);
    setManualHidden(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (autoFade && !isPaused && isIntersectingRef.current) {
      fadeTimerRef.current = setTimeout(() => {
        if (isIntersectingRef.current) {
          setFadedOut(true);
        }
      }, 5000);
    }
  };

  const hideChrome = () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setManualHidden(true);
  };

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;

    const startTimer = () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      setManualHidden(false);
      if (!autoFade || isPaused) {
        setFadedOut(false);
        return;
      }
      setFadedOut(false);
      fadeTimerRef.current = setTimeout(() => {
        if (isIntersectingRef.current) {
          setFadedOut(true);
        }
      }, 5000);
    };

    const stopTimer = () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      setFadedOut(false);
      setManualHidden(false);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        isIntersectingRef.current = isVisible;
        if (isVisible) {
          startTimer();
        } else {
          stopTimer();
        }
      },
      { root: el.closest(".feed"), threshold: [0, 0.6] }
    );

    observer.observe(el);

    if (isIntersectingRef.current) {
      startTimer();
    }

    return () => {
      stopTimer();
      observer.disconnect();
    };
  }, [autoFade, isPaused]);

  function handleCardClick(event) {
    if (event.target.closest("button, a, input, select, textarea, summary")) return;
    if (manualHidden || fadedOut) {
      revealChrome();
    } else {
      hideChrome();
    }
  }

  function handleKeyDown(event) {
    if (event.target.closest("button, a, input, select, textarea, summary")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleCardClick(event);
  }

  const isChromeHidden = !showChrome || manualHidden || (autoFade && fadedOut);

  return (
    <ChromeContext.Provider value={{ isChromeHidden, fadedOut, manualHidden, revealChrome, hideChrome }}>
      <article
        ref={cardRef}
        className={`feed-card ${className} ${isChromeHidden ? "feed-card--chrome-hidden" : ""}`}
        tabIndex="0"
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </article>
    </ChromeContext.Provider>
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
  const primaryUrl = card.object?.media?.thumbnailUrl || card.object?.media?.url || card.downloadUrl;
  const fallbackUrl = card.object?.media?.url;
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  useEffect(() => {
    setCurrentSrc(card.object?.media?.thumbnailUrl || card.object?.media?.url || card.downloadUrl);
  }, [card.id, card.object?.media?.thumbnailUrl, card.object?.media?.url, card.downloadUrl]);

  return (
    <CardFrame className="feed-card--image" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={true}>
      <div className="media-stage image-stage">
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={card.object?.media?.accessibility?.altText || displayTitle}
            className="stage-img"
            loading="lazy"
            onError={(e) => {
              if (fallbackUrl && currentSrc !== fallbackUrl) {
                setCurrentSrc(fallbackUrl);
              } else {
                e.target.style.display = "none";
                e.target.parentElement?.classList.add("media-fallback-active");
              }
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
        if (!audio.paused) setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  return (
    <CardFrame className="feed-card--audio" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={true} isPaused={!isPlaying}>
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

let feedAudioUnlocked = true;

function VideoStage({
  videoRef,
  sources,
  videoUrl,
  thumbnailUrl,
  isPlaying,
  setIsPlaying,
  isMuted,
  setIsMuted,
  mediaError,
  setMediaError,
  media,
  messages,
  toggleMute
}) {
  const { isChromeHidden, revealChrome } = useContext(ChromeContext);

  async function togglePlay(event) {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video || mediaError) return;

    if (isChromeHidden) {
      revealChrome();
      return;
    }

    if (video.paused) {
      feedAudioUnlocked = true;
      video.muted = false;
      video.volume = 1;
      setIsMuted(false);
      try {
        await video.play();
        if (!video.paused) setIsPlaying(true);
      } catch {
        try {
          video.muted = true;
          setIsMuted(true);
          await video.play();
          if (!video.paused) setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div className="media-stage video-stage" onClick={togglePlay}>
      <video
        ref={videoRef}
        className="stage-video"
        src={sources.length ? undefined : (videoUrl || undefined)}
        poster={thumbnailUrl || undefined}
        preload="metadata"
        playsInline
        loop
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={() => setIsMuted(Boolean(videoRef.current?.muted))}
        onError={() => {
          if (videoRef.current?.error) {
            setMediaError(true);
            setIsPlaying(false);
          }
        }}
      >
        {sources.map((s, idx) => (
          <source key={idx} src={s.src} type={s.type} />
        ))}
        {videoUrl && !sources.some((s) => s.src === videoUrl) ? (
          <source src={videoUrl} type={media.mimeType || "video/mp4"} />
        ) : null}
      </video>
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
      <button
        type="button"
        className="video-mute-btn"
        onClick={toggleMute}
        aria-label={isMuted ? messages.unmuteVideo : messages.muteVideo}
        title={isMuted ? messages.unmuteVideo : messages.muteVideo}
        disabled={mediaError}
      >
        {isMuted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
      </button>
      {mediaError ? <p className="media-error">{messages.mediaUnavailable}</p> : null}
    </div>
  );
}

export function VideoCard({ card, saved, onToggleSave, onWhyThis, onWhyOpen, onBranch, messages, locale, showChrome, onToggleChrome }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [isMuted, setIsMuted] = useState(!feedAudioUnlocked);
  const videoRef = useRef(null);
  const videoVisibleRef = useRef(false);
  const media = card.object?.media || {};
  const videoUrl = media.url || card.downloadUrl;
  const thumbnailUrl = media.thumbnailUrl;
  const sources = Array.isArray(media.sources) ? media.sources : [];
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  useEffect(() => {
    setIsPlaying(false);
    setMediaError(false);
    videoVisibleRef.current = false;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      video.load();
    }
    return () => {
      videoRef.current?.pause();
    };
  }, [videoUrl, card.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return undefined;

    const playIfVisible = async () => {
      if (!videoVisibleRef.current || mediaError) return;
      const targetMuted = !feedAudioUnlocked;
      video.muted = targetMuted;
      video.volume = 1;
      try {
        await video.play();
        if (!video.paused) {
          setIsPlaying(true);
          setIsMuted(video.muted);
        }
      } catch {
        if (!video.muted) {
          try {
            video.muted = true;
            setIsMuted(true);
            await video.play();
            if (!video.paused) setIsPlaying(true);
          } catch {
            video.pause();
            setIsPlaying(false);
          }
        } else {
          video.pause();
          setIsPlaying(false);
        }
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

  function toggleMute(event) {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted) {
      video.volume = 1;
      feedAudioUnlocked = true;
    } else {
      feedAudioUnlocked = false;
    }
    setIsMuted(nextMuted);
  }

  return (
    <CardFrame
      className={`feed-card--video ${isPlaying ? "feed-card--playing" : ""}`}
      showChrome={showChrome}
      onToggleChrome={onToggleChrome}
      autoFade={true}
      isPaused={!isPlaying}
    >
      <VideoStage
        videoRef={videoRef}
        sources={sources}
        videoUrl={videoUrl}
        thumbnailUrl={thumbnailUrl}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        mediaError={mediaError}
        setMediaError={setMediaError}
        media={media}
        messages={messages}
        toggleMute={toggleMute}
      />

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

  const candidateImg = card.object?.media?.thumbnailUrl ||
    card.object?.media?.url ||
    card.object?.content?.images?.[0]?.thumbnailUrl ||
    card.object?.content?.images?.[0]?.url ||
    card.mediaUrl ||
    "";

  const [imageUrl, setImageUrl] = useState(candidateImg);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const freshImg = card.object?.media?.thumbnailUrl ||
      card.object?.media?.url ||
      card.object?.content?.images?.[0]?.thumbnailUrl ||
      card.object?.content?.images?.[0]?.url ||
      card.mediaUrl ||
      "";
    setImageUrl(freshImg);
    setImageFailed(false);

    // If no image is on the card yet, but it is a Wikipedia article, fetch article metadata to bring its image into preview
    if (!freshImg && (card.object?.sourceId === "wikipedia" || card.object?.source?.id === "wikipedia" || card.source?.toLowerCase().includes("wikipedia"))) {
      const articleTitle = card.object?.content?.originalTitle || card.object?.content?.title || card.title;
      if (!articleTitle) return;
      const controller = new AbortController();
      fetch(`/api/article?source=wikipedia&title=${encodeURIComponent(articleTitle)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          const item = payload?.data?.item;
          const found = item?.media?.thumbnailUrl || item?.media?.url || item?.content?.images?.[0]?.thumbnailUrl || item?.content?.images?.[0]?.url;
          if (found) {
            setImageUrl(found);
          }
        })
        .catch(() => {});
      return () => controller.abort();
    }
  }, [card.id, card.object?.media?.thumbnailUrl, card.object?.media?.url, card.mediaUrl]);

  return (
    <CardFrame className="feed-card--reader" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={false}>
      <div className="media-stage reader-stage">
        <div className="reader-excerpt-box">
          {imageUrl && !imageFailed ? (
            <div
              className="reader-preview-image-wrap"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer(card, "reader");
              }}
              role="button"
              tabIndex={0}
              aria-label={messages.readArticle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenViewer(card, "reader");
                }
              }}
            >
              <img
                src={imageUrl}
                alt={card.object?.media?.accessibility?.altText || displayTitle}
                className="reader-preview-image"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            </div>
          ) : null}
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
    <CardFrame className="feed-card--map" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={true}>
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
  const primaryUrl = card.object?.media?.thumbnailUrl || card.object?.media?.url || card.downloadUrl;
  const fallbackUrl = card.object?.media?.url;
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const isArabic = locale === "ar";
  const displayTitle = isArabic && card.original ? card.original : card.title;

  useEffect(() => {
    setCurrentSrc(card.object?.media?.thumbnailUrl || card.object?.media?.url || card.downloadUrl);
  }, [card.id, card.object?.media?.thumbnailUrl, card.object?.media?.url, card.downloadUrl]);

  return (
    <CardFrame className="feed-card--museum" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={true}>
      <div className="media-stage museum-stage">
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={card.object?.media?.accessibility?.altText || displayTitle}
            className="museum-img"
            loading="lazy"
            onError={(e) => {
              if (fallbackUrl && currentSrc !== fallbackUrl) {
                setCurrentSrc(fallbackUrl);
              } else {
                e.target.style.display = "none";
                e.target.parentElement?.classList.add("media-fallback-active");
              }
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
    <CardFrame className="feed-card--breathing" showChrome={showChrome} onToggleChrome={onToggleChrome} autoFade={false}>
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
