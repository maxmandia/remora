import type { GenerationThreadSummary } from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
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
} from "@remora/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  ImagePlusIcon,
  LogOut,
  PlusIcon,
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
  onSignOut,
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
    <Sidebar
      collapsible="none"
      className="border-sidebar-border bg-card text-sidebar-foreground relative z-10 min-h-0 !w-full min-w-0 overflow-hidden border-r font-normal shadow-[inset_-1px_0_rgb(255_255_255/0.09),inset_0_1px_rgb(255_255_255/0.06)]"
      aria-label="Remora workspace"
    >
      <div className="flex h-full min-h-0 w-[var(--sidebar-width)] max-w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] shrink-0 flex-col transition-opacity duration-200 ease-out group-data-[state=collapsed]/sidebar-wrapper:pointer-events-none group-data-[state=collapsed]/sidebar-wrapper:opacity-0 motion-reduce:transition-none">
        <SidebarHeader className="gap-4 px-2.5 pt-[calc(var(--remora-titlebar-height))] pb-0">
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
        </SidebarHeader>
        <SidebarContent className="px-2.5">
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
                            aria-hidden={
                              isShowingProjectThreads ? undefined : true
                            }
                            className="grid -translate-y-1 grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[grid-template-rows,opacity,transform] data-[state=closed]:pointer-events-none data-[state=open]:translate-y-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
                            data-slot="app-sidebar-project-threads"
                            data-state={
                              isShowingProjectThreads ? "open" : "closed"
                            }
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
        </SidebarContent>
        <SidebarFooter className="px-2.5 pt-0 pb-3">
          <div className="flex min-h-9 items-center gap-2 py-0 pr-1 pl-[0.4rem]">
            <button
              aria-label="Sign out"
              className="text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground inline-flex size-[1.85rem] shrink-0 cursor-pointer items-center justify-center rounded-[0.45rem] border-0 bg-transparent font-[inherit] transition-colors"
              type="button"
              onClick={onSignOut}
            >
              <LogOut className="size-4 shrink-0" />
            </button>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

function SidebarMenuName({ name }: { name: string }) {
  return (
    <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
      {name}
    </span>
  );
}
