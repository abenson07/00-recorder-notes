import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export function createClient(cookieStore: CookieStore) {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component without mutable cookies — middleware refreshes sessions.
        }
      },
    },
  });
}
