import type { GenerationThreadSummary } from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  WorkspaceSidebar,
} from "@remora/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  FolderIcon,
  FolderOpenIcon,
  ImagePlusIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { TooltipWithShortcut } from "../tooltip-with-shortcut.tsx";

export type ProjectThreadRevealRequest = {
  projectId: string;
  threadId: string;
};

export function AppSidebar({
  projectThreadRevealRequest,
  selectedThreadId,
  threads,
  projects,
  onCreateProject,
  onNewGeneration,
  onNewGenerationInProject,
  onSelectThread,
}: {
  projectThreadRevealRequest: ProjectThreadRevealRequest | null;
  selectedThreadId: string | null;
  threads: GenerationThreadSummary[];
  projects: ProjectSummary[];
  onCreateProject: () => void;
  onNewGeneration: () => void;
  onNewGenerationInProject: (projectId: string) => void;
  onSelectThread: (threadId: string) => void;
  onSignOut: () => void;
}) {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );

  function handleProjectClick(project: ProjectSummary) {
    if (project.threads.length === 0) {
      return;
    }

    setExpandedProjectIds((currentProjectIds) => {
      const nextProjectIds = new Set(currentProjectIds);

      if (nextProjectIds.has(project.id)) {
        nextProjectIds.delete(project.id);
      } else {
        nextProjectIds.add(project.id);
      }

      return nextProjectIds;
    });
  }

  // Reveal the project threads when a new generation is created in a project.
  useEffect(() => {
    if (
      !projectThreadRevealRequest?.projectId ||
      !projectThreadRevealRequest?.threadId
    ) {
      return;
    }

    setExpandedProjectIds((currentProjectIds) => {
      if (currentProjectIds.has(projectThreadRevealRequest.projectId)) {
        return currentProjectIds;
      }

      const nextProjectIds = new Set(currentProjectIds);
      nextProjectIds.add(projectThreadRevealRequest.projectId);

      return nextProjectIds;
    });
  }, [projectThreadRevealRequest]);

  return (
    <WorkspaceSidebar
      aria-label="Remora workspace"
      footer={<AppSidebarFooter />}
      header={<AppSidebarHeader onNewGeneration={onNewGeneration} />}
    >
      <SidebarGroup className="min-h-0 p-0">
        <SidebarGroupLabel className="text-muted-foreground group/projects h-10 justify-between px-2 text-xs">
          <div className="flex w-full min-w-0 items-center justify-between gap-1 select-none">
            <span className="text-[15px]">Projects</span>
            <TooltipWithShortcut
              commandId="app.createProject"
              text="Create project"
              side="inline-end"
            >
              <Button
                aria-label="Create project"
                size="icon"
                type="button"
                variant="ghost"
                onClick={onCreateProject}
              >
                <PlusIcon aria-hidden="true" className="size-3" />
              </Button>
            </TooltipWithShortcut>
          </div>
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1">
          {projects.length > 0 ? (
            <SidebarMenu>
              {projects.map((project) => {
                const isShowingProjectThreads =
                  expandedProjectIds.has(project.id) &&
                  project.threads.length > 0;

                return (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      aria-expanded={
                        project.threads.length > 0
                          ? isShowingProjectThreads
                          : undefined
                      }
                      className="pr-8"
                      type="button"
                      onClick={() => handleProjectClick(project)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {isShowingProjectThreads ? (
                          <FolderOpenIcon className="size-4 shrink-0 stroke-1" />
                        ) : (
                          <FolderIcon className="size-4 shrink-0 stroke-1" />
                        )}
                        <div className="flex items-center gap-1">
                          <SidebarMenuName name={project.name} />
                          {expandedProjectIds.has(project.id) ? (
                            <ChevronDownIcon className="size-4 shrink-0 stroke-1" />
                          ) : (
                            <ChevronRightIcon className="size-4 shrink-0 stroke-1" />
                          )}
                        </div>
                      </div>
                    </SidebarMenuButton>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <SidebarMenuAction
                            aria-label={`New generation in ${project.name}`}
                            className="opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:bg-transparent focus-visible:opacity-100"
                            type="button"
                            onClick={() => {
                              onNewGenerationInProject(project.id);
                            }}
                          >
                            <ImagePlusIcon className="shrink-0 stroke-1" />
                          </SidebarMenuAction>
                        }
                      />
                      <TooltipContent>
                        <span>New generation in {project.name}</span>
                      </TooltipContent>
                    </Tooltip>
                    {project.threads.length > 0 ? (
                      <div
                        aria-hidden={isShowingProjectThreads ? undefined : true}
                        className="grid -translate-y-1 grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[grid-template-rows,opacity,transform] data-[state=closed]:pointer-events-none data-[state=open]:translate-y-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
                        data-slot="app-sidebar-project-threads"
                        data-state={isShowingProjectThreads ? "open" : "closed"}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <SidebarMenuSub>
                            {project.threads.map((thread) => (
                              <SidebarMenuSubItem key={thread.id}>
                                <SidebarMenuSubButton
                                  aria-current={
                                    selectedThreadId === thread.id
                                      ? "page"
                                      : undefined
                                  }
                                  href={`/app/threads/${thread.id}`}
                                  isActive={selectedThreadId === thread.id}
                                  tabIndex={
                                    isShowingProjectThreads ? undefined : -1
                                  }
                                  title={thread.name}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    onSelectThread(thread.id);
                                  }}
                                >
                                  <SidebarMenuName name={thread.name} />
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </div>
                      </div>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          ) : null}
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="min-h-0 flex-1 p-0">
        <SidebarGroupLabel className="text-muted-foreground h-10 justify-between px-2 text-[15px]">
          <span className="select-none">Threads</span>
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1">
          {threads.length > 0 ? (
            <SidebarMenu className="min-h-0 flex-1 overflow-auto pr-0.5">
              {threads.map((thread) => (
                <SidebarMenuItem key={thread.id}>
                  <SidebarMenuButton
                    aria-pressed={selectedThreadId === thread.id}
                    isActive={selectedThreadId === thread.id}
                    title={thread.name}
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                  >
                    <SidebarMenuName name={thread.name} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
            <p className="text-secondary-foreground px-2 text-sm select-none">
              No generations
            </p>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </WorkspaceSidebar>
  );
}

function AppSidebarHeader({
  onNewGeneration,
}: {
  onNewGeneration: () => void;
}) {
  return (
    <SidebarMenu>
      <TooltipWithShortcut
        commandId="app.newGeneration"
        text="Create a new generation"
        side="inline-start"
      >
        <SidebarMenuItem>
          <SidebarMenuButton
            className="text-secondary-foreground min-h-9 gap-[0.55rem] rounded-lg px-[0.65rem]"
            type="button"
            onClick={onNewGeneration}
          >
            <ImagePlusIcon className="size-4 shrink-0" />
            <span>New generation</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </TooltipWithShortcut>
    </SidebarMenu>
  );
}

function AppSidebarFooter() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Settings"
            className="text-secondary-foreground flex w-full items-center justify-start gap-2 py-5"
            type="button"
            variant="ghost"
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span>Settings</span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem>
          <CircleDollarSignIcon />
          Credits
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarMenuName({ name }: { name: string }) {
  return (
    <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
      {name}
    </span>
  );
}
