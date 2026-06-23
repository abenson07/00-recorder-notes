import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import {
  fetchItem,
  fetchProject,
  fetchProjectItems,
} from "@/lib/api/projects-server";
import { ParentProjectDetailClient } from "@/components/projects/ParentProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [parentProject, item] = await Promise.all([
    fetchProject(projectId),
    fetchItem(projectId),
  ]);

  if (item && !parentProject) {
    redirect(`/items/${projectId}`);
  }

  if (!parentProject) {
    notFound();
  }

  const items = await fetchProjectItems(projectId);

  return (
    <ParentProjectDetailClient
      projectId={projectId}
      title={parentProject.title.trim() ? parentProject.title : "Untitled project"}
      description={parentProject.description}
      items={items}
    />
  );
}
