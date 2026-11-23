"use client";

import { useEffect } from "react";

export function JournalScroll() {
  useEffect(() => {
    const media = window.matchMedia("(min-width: 850px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!media.matches || !navigator.onLine) return;

    let disposed = false;
    let removeMotion: (() => void) | undefined;
    const archive = document.querySelector("[data-journal-archive]");
    if (!archive) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]).then(([{ gsap }, { ScrollTrigger }, { default: Lenis }]) => {
        if (disposed || !media.matches) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({
          autoRaf: false,
          smoothWheel: true,
          duration: 0.69,
          prevent: (node) => Boolean(node.closest("dialog, [data-native-scroll]")),
        });
        const update = (seconds: number) => lenis.raf(seconds * 1000);
        gsap.ticker.add(update);
        lenis.on("scroll", ScrollTrigger.update);
        const animation = gsap.fromTo(archive, { "--rule-progress": 0.35 }, {
          "--rule-progress": 1, ease: "none", scrollTrigger: {
            trigger: archive, start: "top 98%", end: "top 63%", scrub: true,
          },
        });
        removeMotion = () => {
          animation.scrollTrigger?.kill();
          animation.kill();
          gsap.ticker.remove(update);
          lenis.destroy();
          if (archive instanceof HTMLElement) archive.style.removeProperty("--rule-progress");
        };
      }).catch(() => { /* Native scrolling remains available. */ });
    }, { rootMargin: "100px" });

    observer.observe(archive);
    const handleMotionChange = () => { if (!media.matches) removeMotion?.(); };
    media.addEventListener("change", handleMotionChange);
    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", handleMotionChange);
      removeMotion?.();
    };
  }, []);
  return null;
}
