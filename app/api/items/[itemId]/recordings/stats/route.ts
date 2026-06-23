import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const itemIdSchema = z.uuid();

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

  try {
    const supabase = createServiceRoleClient();
    const { data: rows, error } = await supabase
      .from("note_recordings")
      .select("id, status")
      .eq("item_id", itemId);

    if (error) {
      console.error("[GET .../recordings/stats]", error);
      return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }

    const list = rows ?? [];
    const total = list.length;
    const transcribed = list.filter((r) => r.status === "transcribed").length;
    const pending = list.filter(
      (r) => r.status === "uploaded" || r.status === "transcription_pending",
    ).length;

    return NextResponse.json({ total, transcribed, pending });
  } catch (e) {
    console.error("[GET .../recordings/stats]", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
