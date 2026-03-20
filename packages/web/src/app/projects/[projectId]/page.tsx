import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  // Default to 台本 (scripts) tab
  redirect(`/projects/${projectId}/scripts`);
}
