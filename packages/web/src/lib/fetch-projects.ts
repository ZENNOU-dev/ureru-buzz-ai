import { adOrchSupabase } from "./ad-orch-supabase";

export interface ProjectListItem {
  id: string;
  name: string;
  client: string;
  status: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, string> = {
  進行中: "制作中",
  停止中: "完了",
};

export async function fetchProjects(): Promise<ProjectListItem[]> {
  if (!adOrchSupabase) return [];

  const { data, error } = await adOrchSupabase
    .from("projects")
    .select("id, name, status, updated_at, clients(company_name)")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[fetchProjects]", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const clients = row.clients as { company_name: string } | null;
    return {
      id: String(row.id),
      name: row.name as string,
      client: clients?.company_name ?? "不明",
      status: STATUS_MAP[row.status as string] ?? (row.status as string),
      updatedAt: ((row.updated_at as string) ?? "").slice(0, 10),
    };
  });
}
