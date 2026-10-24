import { backgroundStyle, type Background } from "@/lib/background";

// Fixed full-page layer behind the app, with a scrim over it so text, on the
// see-through cards too, stays readable whatever colour or picture was chosen.
export function AppBackground({ background, imageUrl }: { background: Background; imageUrl: string | null }) {
  const style = backgroundStyle(background, imageUrl);
  if (!style) return null;
  return (
    // a special skin's scene takes its place (globals.css hides it under [data-skin])
    <div aria-hidden className="app-background pointer-events-none fixed inset-0 -z-10" style={style}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg)_55%,transparent)]" />
    </div>
  );
}
