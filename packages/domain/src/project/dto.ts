export type ProjectThreadSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  threads: ProjectThreadSummary[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
