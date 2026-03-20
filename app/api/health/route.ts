import { NextResponse } from "next/server";
import { getSupabaseConnectEnvHealth } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

/**
 * Lightweight readiness: required Supabase env names present + one trivial DB round-trip.
 * Does not echo secrets or confirm OpenAI.
 */
export async function GET() {
  const envHealth = getSupabaseConnectEnvHealth();
  if (!envHealth.ok) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "misconfigured",
        missingEnv: envHealth.missing,
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("projects").select("id").limit(1);
    if (error) {
      console.error("[health] supabase", error);
      return NextResponse.json(
        { ok: false, supabase: "unreachable", code: error.code ?? "UNKNOWN" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, supabase: "ok" });
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json({ ok: false, supabase: "error" }, { status: 503 });
  }
}
