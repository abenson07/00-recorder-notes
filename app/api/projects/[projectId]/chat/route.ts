import { POST as itemsChatPost } from "@/app/api/items/[itemId]/chat/route";

/** Backward compat: projectId param is treated as itemId. */
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return itemsChatPost(request, { params: Promise.resolve({ itemId: projectId }) });
}
