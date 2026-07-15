import { analyticsService } from "../analytics/analytics.service.ts";
import type { AnalyticsTracker } from "../analytics/analytics.types.ts";
import {
  projectRepository,
  type ProjectRepository,
} from "./project.repository.ts";

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository = projectRepository,
    private readonly analytics: AnalyticsTracker = analyticsService,
  ) {}

  async createProject({ userId, name }: { userId: string; name: string }) {
    const project = await this.repository.createProject({ userId, name });

    this.analytics.track({
      type: "project_created",
      userId,
      projectId: project.id,
      occurredAt: new Date(project.createdAt),
    });

    return project;
  }
}
