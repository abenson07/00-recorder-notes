import { POST as itemsRetrievePost } from "@/app/api/items/[itemId]/retrieve/route";

/** Backward compat: projectId param is treated as itemId. */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return itemsRetrievePost(request, { params: Promise.resolve({ itemId: projectId }) });
}
