import React, { useEffect, useRef, useState } from 'react';
import { FeaturedHighlight, Locale, PortalService } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface FeaturedCarouselProps {
  highlights: FeaturedHighlight[];
  services: PortalService[];
  lang: Locale;
  onSelectService: (serviceId: string) => void;
}

export const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({
  highlights,
  services,
  lang,
  onSelectService,
}) => {
  const strings = PORTAL_UI_STRINGS;
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const pauseUntilRef = useRef<number>(0);

  const total = highlights.length;

  const scrollToSlide = (index: number, smooth = true) => {
    if (!trackRef.current || total === 0) return;
    const boundedIndex = (index + total) % total;
    const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth && !isReduced ? 'smooth' : 'auto';

    trackRef.current.scrollTo({
      left: boundedIndex * trackRef.current.clientWidth,
      behavior,
    });
    setCurrentIndex(boundedIndex);
  };

  const handleNext = () => {
    pauseUntilRef.current = Date.now() + 8000;
    scrollToSlide(currentIndex + 1);
  };

  const handlePrev = () => {
    pauseUntilRef.current = Date.now() + 8000;
    scrollToSlide(currentIndex - 1);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      if (!track) return;
      const width = track.clientWidth || 1;
      const newIndex = Math.round(track.scrollLeft / width);
      if (newIndex >= 0 && newIndex < total && newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [currentIndex, total]);

  // Autoplay interval
  useEffect(() => {
    if (total <= 1) return;
    const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const timer = setInterval(() => {
      if (Date.now() > pauseUntilRef.current && typeof document !== 'undefined' && !document.hidden) {
        scrollToSlide(currentIndex + 1);
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [currentIndex, total]);

  if (total === 0) return null;

  return (
    <section
      className="car"
      aria-roledescription="carousel"
      aria-label={strings.carL[lang]}
      onMouseEnter={() => {
        pauseUntilRef.current = Infinity;
      }}
      onMouseLeave={() => {
        pauseUntilRef.current = Date.now() + 4000;
      }}
      onTouchStart={() => {
        pauseUntilRef.current = Date.now() + 8000;
      }}
    >
      <div
        className="track"
        ref={trackRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNext();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePrev();
          }
        }}
      >
        {highlights.map((hl, i) => {
          const service = services.find((s) => s.id === hl.svc);
          if (!service) return null;

          return (
            <a
              key={hl.svc}
              href="#"
              className="feature"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1}/${total}`}
              onClick={(e) => {
                e.preventDefault();
                onSelectService(service.id);
              }}
              tabIndex={0}
            >
              <span className="tagline">
                <PortalIcon name={service.ic} />
                <span>{hl.b[lang]}</span>
                {hl.p && <span>{hl.p[lang]}</span>}
              </span>
              <h2>{service.n[lang]}</h2>
              <p>{hl.d[lang]}</p>
              <span className="cta">
                <span>{hl.c[lang]}</span>
                <PortalIcon name="arrow" />
              </span>
            </a>
          );
        })}
      </div>

      {total > 1 && (
        <div className="cnav">
          <button
            type="button"
            className="arr"
            onClick={handlePrev}
            aria-label={strings.prev[lang]}
          >
            <PortalIcon name="left" />
          </button>
          <div className="dots">
            {highlights.map((_, i) => (
              <button
                key={i}
                type="button"
                className="dot"
                onClick={() => {
                  pauseUntilRef.current = Date.now() + 8000;
                  scrollToSlide(i);
                }}
                aria-label={`${i + 1}/${total}`}
                aria-current={i === currentIndex}
              />
            ))}
          </div>
          <button
            type="button"
            className="arr"
            onClick={handleNext}
            aria-label={strings.next[lang]}
          >
            <PortalIcon name="right" />
          </button>
        </div>
      )}
    </section>
  );
};
