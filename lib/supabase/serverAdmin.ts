import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/** Service-role client for server routes (bypasses RLS). Never import from client components. */
export function createServiceRoleClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
