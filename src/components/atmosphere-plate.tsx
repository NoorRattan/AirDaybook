"use client";

import { Box, ImageIcon, Pause, Play } from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { AtmosphereProps, Viewpoint } from "./atmosphere-scene";
import { hero, mobileHeroMedia } from "@/lib/hero-assets";

const viewpoints = [
  { id: "street", label: "Street", description: "A pickup can stay at the same time while the place you wait changes. Compare your outdoor waiting minutes in My Plan." },
  { id: "roof", label: "Rooftop", description: "Follow the Metro line through the neighbourhood. Count the walk and wait at both ends when you compare it with a road trip." },
  { id: "sky", label: "Skyline", description: "Use a dated city or station reading to check air quality. The haze in this illustration stays the same for every reading." },
] as const;

type Mode = "still" | "loading" | "3d" | "photo";

class GraphicsBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function AtmospherePlate() {
  const [Scene, setScene] = useState<ComponentType<AtmosphereProps> | null>(null);
  const [mode, setMode] = useState<Mode>("still");
  const [paused, setPaused] = useState(false);
  const [viewpoint, setViewpoint] = useState<Viewpoint>("roof");
  const [message, setMessage] = useState("");
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const active = mode === "loading" || (inView && tabVisible);
  const request = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const redraw = useRef<(() => void) | null>(null);
  const motionButton = useRef<HTMLButtonElement>(null);
  const switchButton = useRef<HTMLButtonElement>(null);

  const showPhoto = useCallback((reason: string) => {
    request.current += 1;
    setMode("photo");
    setMessage(reason);
    if (document.activeElement === motionButton.current) switchButton.current?.focus();
  }, []);
  const graphicsFailed = useCallback(() => showPhoto("3D couldn’t start on this device. Explore the illustration instead."), [showPhoto]);
  const painted = useCallback(() => {
    setMode((current) => current === "loading" ? "3d" : current);
    setMessage("");
  }, []);

  useEffect(() => {
    if (mode !== "loading") return;
    const timer = window.setTimeout(graphicsFailed, 8000);
    return () => window.clearTimeout(timer);
  }, [mode, graphicsFailed]);

  useEffect(() => {
    if (!Scene || !frame.current) return;
    const visibility = () => setTabVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(frame.current);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [Scene]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pauseMotion = () => { if (motion.matches) setPaused(true); };
    motion.addEventListener("change", pauseMotion);
    return () => {
      request.current += 1;
      motion.removeEventListener("change", pauseMotion);
    };
  }, []);

  async function explore() {
    if (!navigator.onLine) {
      showPhoto("The illustration works offline. Connect to load 3D.");
      return;
    }
    const connection = (navigator as Navigator & { connection?: { saveData: boolean } }).connection;
    if (connection?.saveData) {
      showPhoto("Data Saver is on. Using the lightweight illustration.");
      return;
    }
    const current = ++request.current;
    setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMode("loading");
    setMessage("Loading the 3D view…");
    try {
      const { AtmosphereScene } = await import("./atmosphere-scene");
      if (current === request.current) setScene(() => AtmosphereScene);
    } catch {
      if (current === request.current) graphicsFailed();
    }
  }

  function close() {
    request.current += 1;
    setMode("still");
    setViewpoint("roof");
    setMessage("");
  }

  const exploring = mode !== "still";
  const renderScene = (mode === "loading" || mode === "3d") && Scene;
  return (
    <figure className="atmosphere-plate" aria-labelledby="atmosphere-caption">
      <div ref={frame} className="plate-window" data-view={mode === "photo" ? viewpoint : undefined} onPointerMove={(event) => {
        if (mode !== "3d" || paused || !active || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        pointer.current = { x: (event.clientX - box.left) / box.width - 0.5, y: (event.clientY - box.top) / box.height - 0.5 };
        redraw.current?.();
      }} onPointerLeave={() => {
        pointer.current = { x: 0, y: 0 };
        if (mode === "3d" && !paused && active) redraw.current?.();
      }}>
        <picture>
          <source type="image/avif" media={mobileHeroMedia} srcSet={hero.mobileAvif.src} />
          <source type="image/avif" srcSet={hero.desktopAvif.src} />
          <source media={mobileHeroMedia} srcSet={hero.mobileWebp.src} />
          <img src={hero.desktopWebp.src} className="plate-image"
            alt="Delhi rooftops and an elevated Metro train under winter haze."
            width={1440} height={720} fetchPriority="high" />
        </picture>
        {renderScene && (
          <div aria-hidden className={mode === "3d" ? "plate-scene is-ready" : "plate-scene"}>
            <GraphicsBoundary onError={graphicsFailed}>
              <Scene viewpoint={viewpoint} paused={paused} active={active} pointer={pointer} redraw={redraw} onPaint={painted} onUnavailable={graphicsFailed} />
            </GraphicsBoundary>
          </div>
        )}
      </div>
      <figcaption>
        <div>
          <strong id="atmosphere-caption">Delhi in winter</strong>
          <p>Illustration of the neighbourhood</p>
        </div>
        <button className="button button-plate" type="button" ref={switchButton} onClick={exploring ? close : explore}>
          {exploring ? <ImageIcon size={17} aria-hidden /> : <Box size={17} aria-hidden />}
          {mode === "loading" ? "Cancel loading" : exploring ? "Show still" : "Explore 3D"}
        </button>
      </figcaption>
      <p role="status" className="scene-message">{message || (paused && mode === "3d" ? "Motion paused. Choose a viewpoint." : "")}</p>
      {exploring && mode !== "loading" && (
        <div className="scene-controls">
          <div className="scene-toolbar">
            <div className="scene-views" role="group" aria-label="Illustration viewpoint">
              {viewpoints.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={viewpoint === id} onClick={() => setViewpoint(id)}>{label}</button>
              ))}
            </div>
            {mode === "3d" && <button type="button" ref={motionButton} className="scene-icon" aria-label={paused ? "Resume scene motion" : "Pause scene motion"} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={17} aria-hidden /> : <Pause size={17} aria-hidden />}</button>}
          </div>
          <p className="scene-description">{viewpoints.find(({ id }) => id === viewpoint)?.description}</p>
        </div>
      )}
    </figure>
  );
}
