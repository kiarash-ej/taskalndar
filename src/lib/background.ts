import type { CSSProperties } from "react";

// A user's chosen page background (profiles.background_kind / background_value).
export type BackgroundKind = "none" | "color" | "gradient" | "image";

export interface Background {
  kind: BackgroundKind;
  // color: "#rrggbb" · gradient: a GRADIENTS id · image: storage path in BACKGROUND_BUCKET
  value: string | null;
}

export const NO_BACKGROUND: Background = { kind: "none", value: null };

export const BACKGROUND_BUCKET = "backgrounds";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const COLORS = ["#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#b45309", "#334155"] as const;

export const GRADIENTS = [
  { id: "sunset", label: "غروب", css: "linear-gradient(135deg, #f97316, #db2777)" },
  { id: "ocean", label: "اقیانوس", css: "linear-gradient(135deg, #0ea5e9, #1e3a8a)" },
  { id: "forest", label: "جنگل", css: "linear-gradient(135deg, #16a34a, #064e3b)" },
  { id: "dusk", label: "شفق", css: "linear-gradient(135deg, #8b5cf6, #1e1b4b)" },
  { id: "sand", label: "شن", css: "linear-gradient(135deg, #fde68a, #d97706)" },
  { id: "slate", label: "خاکستری", css: "linear-gradient(135deg, #64748b, #0f172a)" },
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function gradientById(id: unknown) {
  return GRADIENTS.find((g) => g.id === id);
}

// Treats anything unrecognised (e.g. a stale or hand-edited row) as "no background".
export function parseBackground(kind: string | null, value: string | null): Background {
  if (kind === "color" && isHexColor(value)) return { kind, value };
  if (kind === "gradient" && gradientById(value)) return { kind, value };
  if (kind === "image" && value) return { kind, value };
  return NO_BACKGROUND;
}

// `imageUrl` is where an "image" background is served (backgroundImageUrl).
export function backgroundStyle(bg: Background, imageUrl?: string | null): CSSProperties | null {
  if (bg.kind === "color" && bg.value) return { backgroundColor: bg.value };
  if (bg.kind === "gradient") {
    const gradient = gradientById(bg.value);
    return gradient ? { backgroundImage: gradient.css } : null;
  }
  if (bg.kind === "image" && imageUrl) {
    return {
      backgroundImage: `url("${imageUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return null;
}
