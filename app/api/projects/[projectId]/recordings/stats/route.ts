import { GET as itemsStatsGet } from "@/app/api/items/[itemId]/recordings/stats/route";

/** Backward compat: projectId param is treated as itemId. */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return itemsStatsGet(request, { params: Promise.resolve({ itemId: projectId }) });
}
