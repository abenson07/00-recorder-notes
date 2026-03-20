export type ServerEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_STORAGE_BUCKET_AUDIO"
  | "OPENAI_API_KEY"
  | "OPENAI_BASE_URL";

export interface ServerEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET_AUDIO: string;
  OPENAI_API_KEY: string;
  /** API base including `/v1`, e.g. `https://api.openai.com/v1`. */
  OPENAI_BASE_URL: string;
}

let cached: ServerEnv | null = null;

function requireNonEmpty(name: ServerEnvKey, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `[env] Missing or empty "${name}". Add it to .env.local (see .env.example).`,
    );
  }
  return trimmed;
}

function assertLooksLikeUrl(name: ServerEnvKey, value: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(
      `[env] "${name}" must be a valid URL. Current value is not parseable as a URL.`,
    );
  }
}

/** Validates required server env. Safe to call from Server Components, Route Handlers, and server-only modules. */
export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached;
  }

  const env: ServerEnv = {
    NEXT_PUBLIC_SUPABASE_URL: requireNonEmpty(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: requireNonEmpty(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    ),
    SUPABASE_SERVICE_ROLE_KEY: requireNonEmpty(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    SUPABASE_STORAGE_BUCKET_AUDIO: requireNonEmpty(
      "SUPABASE_STORAGE_BUCKET_AUDIO",
      process.env.SUPABASE_STORAGE_BUCKET_AUDIO,
    ),
    OPENAI_API_KEY: requireNonEmpty("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    OPENAI_BASE_URL: (
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
    ).replace(/\/$/, ""),
  };

  assertLooksLikeUrl("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  assertLooksLikeUrl("OPENAI_BASE_URL", env.OPENAI_BASE_URL);

  cached = env;
  return env;
}

/** Call from root layout so misconfiguration fails immediately on boot. */
export function ensureServerEnvLoaded(): void {
  getServerEnv();
}

const HEALTH_REQUIRED_KEYS: ServerEnvKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET_AUDIO",
];

/**
 * Non-throwing env check for `/api/health` (never exposes secret values).
 */
export function getSupabaseConnectEnvHealth(): {
  ok: boolean;
  missing: ServerEnvKey[];
} {
  const missing: ServerEnvKey[] = [];
  for (const key of HEALTH_REQUIRED_KEYS) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }
  return { ok: missing.length === 0, missing };
}
