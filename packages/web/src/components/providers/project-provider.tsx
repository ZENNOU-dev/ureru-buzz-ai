"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface ProjectOption {
  id: string;
  name: string;
}

const PROJECTS: ProjectOption[] = [
  { id: "14", name: "REDEN" },
  { id: "18", name: "ローコスト" },
];

const STORAGE_KEY = "zennou-project-id";

function getInitialId(): string {
  if (typeof window === "undefined") return PROJECTS[0].id;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && PROJECTS.some((p) => p.id === saved)) return saved;
  return PROJECTS[0].id;
}

interface ProjectContextValue {
  projects: ProjectOption[];
  currentProject: ProjectOption;
  setCurrentProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentId, setCurrentId] = useState(getInitialId);

  const current = PROJECTS.find((p) => p.id === currentId) ?? PROJECTS[0];

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  // Sync on mount (SSR hydration)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== currentId && PROJECTS.some((p) => p.id === saved)) {
      setCurrentId(saved);
    }
  }, []);

  return (
    <ProjectContext value={{ projects: PROJECTS, currentProject: current, setCurrentProjectId }}>
      {children}
    </ProjectContext>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
