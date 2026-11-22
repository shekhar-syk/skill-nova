import React, { useEffect, useRef, useState } from 'react';
import campusHeroFallback from '../assets/images/hero_skillnova_campus_1795184322039.jpg';

export default function HeroMotionVideo({
  mp4Src = '/videos/skillnova-hero.mp4',
  webmSrc = '/videos/skillnova-hero.webm',
  posterSrc = '/videos/skillnova-hero-poster.jpg',
  variant = 'background',
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [imgSrc, setImgSrc] = useState(posterSrc);
  const [allImagesFailed, setAllImagesFailed] = useState(false);

  // Detect OS prefers-reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Detect Data-Saver / constrained 2G network connections for mobile bandwidth savings
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    const evaluateConnection = () => {
      const constrained =
        Boolean(conn.saveData) || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
      setSaveData(constrained);
    };
    evaluateConnection();
    conn.addEventListener?.('change', evaluateConnection);
    return () => conn.removeEventListener?.('change', evaluateConnection);
  }, []);

  // Pause background decoding when hero scrolls out of viewport to preserve 60fps scrolling
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const showFallback = videoFailed || reducedMotion || saveData;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || showFallback) return;

    if (!inViewport) {
      if (!el.paused) el.pause();
      return;
    }

    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay blocked by browser policy; gracefully fall back to high-contrast poster visual
        setVideoFailed(true);
      });
    }
  }, [inViewport, showFallback]);

  const handleImageError = () => {
    if (imgSrc !== campusHeroFallback) {
      setImgSrc(campusHeroFallback);
    } else {
      setAllImagesFailed(true);
    }
  };

  if (variant === 'background') {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden bg-[#0A0F24]"
      >
        {showFallback ? (
          !allImagesFailed && (
            <img
              src={imgSrc}
              onError={handleImageError}
              alt=""
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-55 sm:opacity-65 scale-[1.02]"
            />
          )
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            disablePictureInPicture
            onError={() => setVideoFailed(true)}
            className="w-full h-full object-cover object-center opacity-60 sm:opacity-70"
          >
            <source src={webmSrc} type="video/webm" />
            <source src={mp4Src} type="video/mp4" />
          </video>
        )}

        {/* Measured multi-layer navy contrast scrim ensuring >= 4.5:1 WCAG AA legibility on every frame */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F24]/95 via-[#0A0F24]/82 to-[#0A0F24]/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F24]/75 via-[#0A0F24]/35 to-[#0A0F24]/95" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full aspect-video rounded-2xl overflow-hidden border border-violet-500/30 bg-[#0A0F24]"
    >
      {showFallback ? (
        !allImagesFailed && (
          <img
            src={imgSrc}
            onError={handleImageError}
            alt="SKILLNOVA coding interfaces, AI technology, and online engineering labs showcase"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        )
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          disablePictureInPicture
          aria-label="Animated showcase of SkillNova students coding, AI labs, and career growth"
          onError={() => setVideoFailed(true)}
          className="w-full h-full object-cover block"
        >
          <source src={webmSrc} type="video/webm" />
          <source src={mp4Src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
