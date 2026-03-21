export function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) {
      return "just now";
    }
    if (mins < 60) {
      return `${mins} min ago`;
    }
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) {
      return `${hrs} hr ago`;
    }
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return "";
  }
}
