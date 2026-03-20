/** ~1000 chars max per chunk; prefers paragraph boundaries, then sentences. */

const TARGET_MAX = 1000;
const OVERLAP = 120;

function splitLongParagraph(p: string): string[] {
  const sentences = p.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = "";

  for (const s of sentences) {
    const next = buf ? `${buf} ${s}` : s;
    if (next.length <= TARGET_MAX) {
      buf = next;
      continue;
    }
    if (buf.trim()) {
      out.push(buf.trim());
    }
    if (s.length <= TARGET_MAX) {
      buf = s;
      continue;
    }
    for (let i = 0; i < s.length; i += TARGET_MAX - OVERLAP) {
      const slice = s.slice(i, i + TARGET_MAX).trim();
      if (slice) {
        out.push(slice);
      }
    }
    buf = "";
  }
  if (buf.trim()) {
    out.push(buf.trim());
  }
  return out;
}

export function chunkTranscriptText(fullText: string): string[] {
  const text = fullText.trim();
  if (!text) {
    return [];
  }

  const paragraphs = text.split(/\n\s*\n+/);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    const p = para.replace(/\s+/g, " ").trim();
    if (!p) {
      continue;
    }
    if (p.length <= TARGET_MAX) {
      chunks.push(p);
    } else {
      chunks.push(...splitLongParagraph(p));
    }
  }

  return chunks;
}
