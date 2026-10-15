import { backgroundStyle, type Background } from "@/lib/background";

// Fixed full-page layer behind the app, with a scrim over it so text outside
// the (opaque) cards stays readable whatever colour or picture was chosen.
export function AppBackground({ background, imageUrl }: { background: Background; imageUrl: string | null }) {
  const style = backgroundStyle(background, imageUrl);
  if (!style) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={style}>
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg)_55%,transparent)]" />
    </div>
  );
}
