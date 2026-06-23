import { NextResponse } from "next/server";
import { GET as itemsGet, POST as itemsPost } from "@/app/api/items/[itemId]/recordings/route";

/** Backward compat: projectId param is treated as itemId. */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return itemsGet(request, { params: Promise.resolve({ itemId: projectId }) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return itemsPost(request, { params: Promise.resolve({ itemId: projectId }) });
}
