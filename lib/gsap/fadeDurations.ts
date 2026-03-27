/** Durations (seconds) for cross-fades; zero when user prefers reduced motion. */
export function gsapFadeDurations(): { out: number; in: number } {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { out: 0, in: 0 };
  }
  return { out: 0.18, in: 0.22 };
}
