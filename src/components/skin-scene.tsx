"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { parseSkin, seeded, type Skin } from "@/lib/skins";

// The living background of a special skin, behind everything (the cards stay
// opaque, so text is never over moving shapes). It follows <html data-skin>,
// which the settings picker changes without a reload.

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });
  return () => observer.disconnect();
}

export function SkinScene({ initial }: { initial: Skin | null }) {
  const skin = useSyncExternalStore(
    subscribe,
    () => parseSkin(document.documentElement.dataset.skin),
    () => initial,
  );
  if (!skin) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {skin === "ocean" && <Ocean />}
      {skin === "galaxy" && <Galaxy />}
      {skin === "forest" && <Forest />}
      {skin === "sakura" && <Sakura />}
      {skin === "aurora" && <Aurora />}
    </div>
  );
}

// generated numbers rounded, so the server's HTML and the browser's styles match exactly
const r = (n: number) => Math.round(n * 100) / 100;

const tint = (percent: number) => `color-mix(in srgb, var(--accent) ${percent}%, var(--bg))`;
const fade = (percent: number) => `color-mix(in srgb, var(--accent) ${percent}%, transparent)`;
const vars = (v: Record<string, string | number>) => v as CSSProperties;

// one wave, drawn twice side by side so sliding by half loops seamlessly
const WAVE = "M0 40 Q 150 0 300 40 T 600 40 T 900 40 T 1200 40 V 120 H 0 Z";

function Ocean() {
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to bottom, var(--bg) 35%, ${tint(22)})` }}>
      {[
        { h: 170, o: 18, d: 34 },
        { h: 130, o: 26, d: 24 },
        { h: 95, o: 38, d: 16 },
      ].map((w, i) => (
        <svg
          key={i}
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-[200%]"
          style={{
            height: w.h,
            fill: fade(w.o),
            animation: `wave-drift ${w.d}s linear infinite`,
            animationDirection: i % 2 ? "reverse" : "normal",
          }}
        >
          <path d={WAVE} />
          <path d={WAVE} transform="translate(1200 0)" />
        </svg>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const size = r(6 + seeded(i) * 14);
        return (
          <span
            key={i}
            className="absolute bottom-0 rounded-full border"
            style={vars({
              left: `${r(seeded(i, 2) * 100)}%`,
              width: size,
              height: size,
              borderColor: fade(45),
              backgroundColor: fade(8),
              "--drift": `${r((seeded(i, 3) - 0.5) * 80)}px`,
              animation: `rise ${r(10 + seeded(i, 4) * 10)}s ease-in infinite`,
              animationDelay: `${r(-seeded(i, 5) * 20)}s`,
            })}
          />
        );
      })}
    </div>
  );
}

function Galaxy() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = Array.from({ length: 140 }, (_, i) => ({
      x: seeded(i, 7),
      y: seeded(i, 8),
      r: 0.5 + seeded(i, 9) * 1.4,
      p: seeded(i, 10) * Math.PI * 2,
    }));
    let frame = 0;
    let shooting: { x: number; y: number; t: number } | null = null;
    let nextShot = 3;

    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const star = getComputedStyle(cv).getPropertyValue("--scene-star").trim() || "#fef3c7";
      const s = time / 1000;
      ctx.fillStyle = star;
      for (const st of stars) {
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(s * 0.8 + st.p));
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // now and then a shooting star crosses the top half
      if (!shooting && s > nextShot) shooting = { x: 0.2 + Math.random() * 0.7, y: Math.random() * 0.35, t: s };
      if (shooting) {
        const k = (s - shooting.t) / 0.9;
        if (k > 1) {
          shooting = null;
          nextShot = s + 5 + Math.random() * 6;
        } else {
          const x = (shooting.x - k * 0.25) * w;
          const y = (shooting.y + k * 0.18) * h;
          const g = ctx.createLinearGradient(x, y, x + 90, y - 60);
          g.addColorStop(0, star);
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 90, y - 60);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const onResize = () => reduced && requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: "var(--bg)",
        backgroundImage: [
          `radial-gradient(ellipse 60% 45% at 18% 22%, ${fade(28)}, transparent 70%)`,
          `radial-gradient(ellipse 50% 40% at 85% 75%, color-mix(in srgb, #ec4899 18%, transparent), transparent 70%)`,
          `radial-gradient(ellipse 45% 35% at 60% 10%, color-mix(in srgb, #38bdf8 14%, transparent), transparent 70%)`,
        ].join(","),
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}

const LEAF = "M12 2C6 6 3 11 4 17c4 1 9-1 12-5 2-3 3-7 3-10-3 0-5 0-7 0z";

function Forest() {
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to bottom, ${tint(12)}, var(--bg) 60%)` }}>
      {/* light through the branches */}
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="absolute -top-20 h-[140vh] w-24 origin-top"
          style={{
            insetInlineStart: `${8 + i * 16}%`,
            rotate: "22deg",
            backgroundImage: `linear-gradient(to bottom, ${fade(30)}, transparent 70%)`,
            filter: "blur(10px)",
            animation: `ray ${5 + i}s ease-in-out infinite alternate`,
            animationDelay: `${-i * 1.3}s`,
          }}
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={vars({
            left: `${r(seeded(i, 11) * 100)}%`,
            "--drift": `${r((seeded(i, 12) - 0.3) * 160)}px`,
            animation: `fall ${r(14 + seeded(i, 13) * 12)}s linear infinite`,
            animationDelay: `${r(-seeded(i, 14) * 26)}s`,
          })}
        >
          <svg
            viewBox="0 0 24 24"
            width={r(16 + seeded(i, 15) * 14)}
            height={r(16 + seeded(i, 15) * 14)}
            style={vars({
              fill: i % 3 === 0 ? "color-mix(in srgb, #ca8a04 55%, transparent)" : fade(55),
              "--from": "-30deg",
              "--to": "40deg",
              animation: `sway ${r(2.5 + seeded(i, 16) * 2)}s ease-in-out infinite alternate`,
            })}
          >
            <path d={LEAF} />
          </svg>
        </span>
      ))}
    </div>
  );
}

function Sakura() {
  return (
    <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(160deg, ${tint(14)}, var(--bg) 55%)` }}>
      {Array.from({ length: 22 }, (_, i) => {
        const size = r(9 + seeded(i, 21) * 9);
        return (
          <span
            key={i}
            className="absolute top-0"
            style={vars({
              left: `${r(seeded(i, 22) * 110 - 10)}%`,
              "--drift": `${r(80 + seeded(i, 23) * 160)}px`,
              animation: `fall ${r(11 + seeded(i, 24) * 9)}s linear infinite`,
              animationDelay: `${r(-seeded(i, 25) * 20)}s`,
            })}
          >
            <span
              className="block"
              style={vars({
                width: size,
                height: r(size * 0.75),
                borderRadius: "150% 0 150% 0",
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, #fbcfe8 90%, transparent), ${fade(60)})`,
                "--from": "-50deg",
                "--to": "70deg",
                animation: `sway ${r(1.8 + seeded(i, 26) * 1.6)}s ease-in-out infinite alternate`,
              })}
            />
          </span>
        );
      })}
    </div>
  );
}

function Aurora() {
  return (
    <div className="absolute inset-0" style={{ backgroundColor: "var(--bg)" }}>
      {[
        { color: "#10b981", top: "-8%", d: 16, o: 0.4 },
        { color: "#6366f1", top: "6%", d: 22, o: 0.35 },
        { color: "#ec4899", top: "18%", d: 19, o: 0.25 },
      ].map((band, i) => (
        <span
          key={i}
          className="absolute -inset-x-1/4 h-[38vh] rounded-[50%]"
          style={{
            top: band.top,
            opacity: band.o,
            backgroundImage: `linear-gradient(90deg, transparent, ${band.color}, transparent)`,
            filter: "blur(48px)",
            animation: `aurora ${band.d}s ease-in-out infinite alternate`,
            animationDelay: `${-i * 4}s`,
          }}
        />
      ))}
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="absolute size-0.5 rounded-full"
          style={{
            left: `${r(seeded(i, 31) * 100)}%`,
            top: `${r(seeded(i, 32) * 55)}%`,
            backgroundColor: "var(--scene-star)",
            animation: `twinkle ${r(1.5 + seeded(i, 33) * 2)}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
