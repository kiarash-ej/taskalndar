// Special skins: an accent palette plus a living scene behind the app (waves,
// stars, leaves…). They sit on top of light/dark mode: each skin has accent
// colours for both, in globals.css under :root[data-skin]. Like the theme,
// the choice lives in a cookie so pages arrive in the right look; none is
// applied until the user picks one.

export const SKIN_COOKIE = "skin";
export const SKINS = ["ocean", "galaxy", "forest", "sakura", "aurora"] as const;
export type Skin = (typeof SKINS)[number];

export const SKIN_INFO: Record<Skin, { label: string; description: string; swatch: string }> = {
  ocean: {
    label: "اقیانوس",
    description: "موج‌هایی که آرام می‌روند و حباب‌هایی که بالا می‌آیند",
    swatch: "linear-gradient(180deg, #7dd3fc 0%, #0ea5e9 55%, #0c4a6e 100%)",
  },
  galaxy: {
    label: "کهکشان",
    description: "ستاره‌های چشمک‌زن، سحابی و گاهی یک شهاب",
    swatch: "radial-gradient(circle at 30% 30%, #a78bfa 0%, #4c1d95 45%, #0b0a24 100%)",
  },
  forest: {
    label: "جنگل",
    description: "نور از لای شاخه‌ها و برگ‌هایی که می‌ریزند",
    swatch: "linear-gradient(160deg, #bbf7d0 0%, #22c55e 50%, #14532d 100%)",
  },
  sakura: {
    label: "شکوفه",
    description: "گلبرگ‌های بهاری که در باد می‌رقصند",
    swatch: "linear-gradient(160deg, #fdf2f8 0%, #f9a8d4 50%, #db2777 100%)",
  },
  aurora: {
    label: "شفق قطبی",
    description: "نوارهای رنگی نور که آرام در آسمان جاری‌اند",
    swatch: "linear-gradient(135deg, #0f172a 0%, #10b981 40%, #6366f1 75%, #ec4899 100%)",
  },
};

// The moving backgrounds; each built-in skin uses one, personal themes pick any.
export const SCENES = ["waves", "stars", "leaves", "petals", "aurora"] as const;
export type Scene = (typeof SCENES)[number];

export const SCENE_LABELS: Record<Scene | "none", string> = {
  none: "بدون حرکت",
  waves: "موج",
  stars: "ستاره",
  leaves: "برگ",
  petals: "گلبرگ",
  aurora: "شفق",
};

export const SKIN_SCENE: Record<Skin, Scene> = {
  ocean: "waves",
  galaxy: "stars",
  forest: "leaves",
  sakura: "petals",
  aurora: "aurora",
};

// The skin cookie holds a built-in skin's name, or "custom-<id>" for a personal theme.
export const CUSTOM_PREFIX = "custom-";

export function parseSkin(value: unknown): Skin | null {
  return (SKINS as readonly unknown[]).includes(value) ? (value as Skin) : null;
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

// `skin`: a built-in skin, "custom-<id>", or null for none.
export function skinCookie(skin: string | null): string {
  return skin === null
    ? `${SKIN_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${SKIN_COOKIE}=${skin}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}

// A repeatable pseudo-random number in [0, 1) for scene element `i`, so the
// server and the browser draw the same leaves and stars (no hydration mismatch).
export function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
