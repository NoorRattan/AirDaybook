"use client";

import { Box, Crosshair, ImageIcon, Pause, Play, RotateCcw } from "lucide-react";
import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { AtmosphereProps, Viewpoint } from "./atmosphere-scene";

const viewpoints: { id: Viewpoint; label: string }[] = [
  { id: "street", label: "Street" },
  { id: "roof", label: "Rooftop" },
  { id: "sky", label: "Skyline" },
];

class GraphicsBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function AtmospherePlate() {
  const [Scene, setScene] = useState<ComponentType<AtmosphereProps> | null>(null);
  const [active, setActive] = useState(false);
  const [painted, setPainted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [viewpoint, setViewpoint] = useState<Viewpoint>("roof");
  const [message, setMessage] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const loading = useRef(0);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      if (!motion.matches) return;
      loading.current++;
      setActive(false);
      setPainted(false);
    };
    motion.addEventListener("change", onMotion);
    return () => {
      loading.current++;
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  async function openScene() {
    const connection = (navigator as Navigator & { connection?: { saveData: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) {
      setMessage("Showing the still illustration to respect your motion or data settings.");
      return;
    }
    const canvas = document.createElement("canvas");
    const graphics = canvas.getContext("webgl2");
    if (!graphics) {
      setMessage("3D is unavailable here. The still illustration is available.");
      return;
    }
    graphics.getExtension("WEBGL_lose_context")?.loseContext();
    const request = ++loading.current;
    setPainted(false);
    setPaused(false);
    setActive(true);
    setMessage("Loading the 3D illustration…");
    try {
      const module = await import("./atmosphere-scene");
      if (loading.current === request) setScene(() => module.AtmosphereScene);
    } catch {
      if (loading.current === request) graphicsFailed();
    }
  }

  function returnToStill() {
    loading.current++;
    setActive(false);
    setPainted(false);
    setMessage("");
  }

  function graphicsFailed() {
    returnToStill();
    setMessage("The 3D illustration could not start. Showing the still.");
  }

  return (
    <figure className="atmosphere-plate">
      <div
        className="plate-window"
        ref={frame}
        onPointerMove={(event) => {
          if (!active || paused || event.pointerType === "touch") return;
          const box = event.currentTarget.getBoundingClientRect();
          pointer.current = {
            x: ((event.clientX - box.left) / box.width - 0.5) * 2,
            y: ((event.clientY - box.top) / box.height - 0.5) * 2,
          };
        }}
        onPointerLeave={() => { pointer.current = { x: 0, y: 0 }; }}
      >
        <picture>
          <source media="(max-width: 700px)" srcSet="/delhi-metro-dawn-small.webp" />
          <img
            src="/delhi-metro-dawn.webp" className="plate-image"
            alt="Illustration of Delhi’s rooftops and elevated Metro line under winter haze."
            width={1440} height={720} fetchPriority="high"
          />
        </picture>
        {active && Scene && (
          <div aria-hidden className={painted ? "plate-scene is-ready" : "plate-scene"}>
            <GraphicsBoundary onError={graphicsFailed}>
              <Scene
                viewpoint={viewpoint}
                paused={paused}
                visible={visible}
                pointer={pointer}
                onPaint={() => { setPainted(true); setMessage(""); }}
                onUnavailable={graphicsFailed}
              />
            </GraphicsBoundary>
          </div>
        )}
        <div className="plate-mark" aria-hidden><Crosshair size={17} strokeWidth={1.1} /></div>
        {active && painted && (
          <div className="scene-toolbar" data-native-scroll>
            <div className="scene-views" role="group" aria-label="Illustration viewpoint">
              {viewpoints.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={viewpoint === id} onClick={() => setViewpoint(id)}>{label}</button>
              ))}
            </div>
            <button type="button" className="scene-icon" aria-label={paused ? "Resume scene motion" : "Pause scene motion"} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={17} aria-hidden /> : <Pause size={17} aria-hidden />}
            </button>
            <button type="button" className="scene-icon" aria-label="Reset illustration viewpoint" onClick={() => { setViewpoint("roof"); pointer.current = { x: 0, y: 0 }; }}>
              <RotateCcw size={17} aria-hidden />
            </button>
          </div>
        )}
        <p className="scene-message" role="status">{message}</p>
      </div>
      <figcaption>
        <div>
          <span className="eyebrow">{painted ? "Atmosphere study" : "City study"}</span>
          <p>{painted ? "Interactive illustration · independent of AQI" : "Delhi winter · Illustration"}</p>
        </div>
        <button type="button" className="button button-plate" aria-pressed={active} onClick={active ? returnToStill : openScene}>
          {active ? <ImageIcon size={17} aria-hidden /> : <Box size={17} aria-hidden />}
          {active ? "Show still" : "Explore 3D"}
        </button>
      </figcaption>
    </figure>
  );
}
