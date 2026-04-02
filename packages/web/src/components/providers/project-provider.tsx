"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface ProjectOption {
  id: string;
  name: string;
}

const PROJECTS: ProjectOption[] = [
  { id: "14", name: "REDEN" },
  { id: "18", name: "ローコスト" },
];

interface ProjectContextValue {
  projects: ProjectOption[];
  currentProject: ProjectOption;
  setCurrentProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentId, setCurrentId] = useState(PROJECTS[0].id);

  const current = PROJECTS.find((p) => p.id === currentId) ?? PROJECTS[0];

  const setCurrentProjectId = useCallback((id: string) => {
    setCurrentId(id);
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
