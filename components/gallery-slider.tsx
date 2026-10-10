"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Slide {
  title: string;
  caption: string;
  credit?: { author: string; license: string; url: string };
  /** The photo or illustration, rendered on the server. */
  media: React.ReactNode;
}

const INTERVAL_MS = 4500;

/** Shows the gallery one picture at a time, moving on by itself and with arrows, dots or the keyboard. */
export function GallerySlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((step: number) => setIndex((i) => (i + step + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => go(1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, go, slides.length]);

  const current = slides[index]!;
  return (
    <div
      className="grid gap-4"
      role="region"
      aria-roledescription="carousel"
      aria-label="Gallery"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border bg-brand-dark shadow-xl shadow-brand/15">
        <div className="relative aspect-[16/10] sm:aspect-[16/8]">
          {slides.map((slide, i) => (
            <div
              key={slide.title}
              aria-hidden={i !== index}
              className={cn(
                "absolute inset-0 transition-all duration-700 ease-out",
                i === index ? "scale-100 opacity-100" : "pointer-events-none scale-105 opacity-0",
              )}
            >
              {slide.media}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white">
            <p key={current.title} className="rise text-xl font-bold">{current.title}</p>
            <p className="text-sm text-white/85">{current.caption}</p>
            {current.credit && (
              <p className="pointer-events-auto mt-1 text-[11px] text-white/70">
                Photo:{" "}
                <a href={current.credit.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {current.credit.author}
                </a>
                , {current.credit.license}
              </p>
            )}
          </div>
          <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white tabular-nums" aria-live="polite">
            {index + 1} / {slides.length}
          </span>
        </div>

        {[{ step: -1, label: "Previous picture", Icon: ChevronLeft, side: "left-3" }, { step: 1, label: "Next picture", Icon: ChevronRight, side: "right-3" }].map(
          ({ step, label, Icon, side }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => go(step)}
              className={cn(
                "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand shadow-md transition-transform hover:scale-110",
                side,
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          ),
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            aria-label={`Show picture ${i + 1}: ${slide.title}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn("h-2.5 rounded-full transition-all duration-300", i === index ? "w-8 bg-brand" : "w-2.5 bg-brand/25 hover:bg-brand/50")}
          />
        ))}
      </div>
    </div>
  );
}
