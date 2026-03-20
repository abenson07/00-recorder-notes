import { headers } from "next/headers";

/** Build public origin for same-host fetches from Server Components / route handlers. */
export async function getAppOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() ?? "http";

  if (host) {
    const hostname = host.split(",")[0]?.trim();
    if (hostname) {
      return `${proto}://${hostname}`;
    }
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  return "http://localhost:3000";
}
