import type { ProjectSummary } from "@remora/domain/project/dto";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
} from "@remora/ui";
import { FolderIcon, FolderXIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

const noProjectComboboxLabel = "Don't work in a project";
const noProjectComboboxValue = "__remora-no-project__";
const projectComboboxPlaceholder = "Select a project to work in";

type ProjectSelectorItemBase = {
  id: string;
  icon?: ReactNode;
};

type ProjectSelectorProjectItem = ProjectSelectorItemBase & {
  type: "project";
  project: ProjectSummary;
};

type ProjectSelectorNoProjectItem = ProjectSelectorItemBase & {
  type: "no-project";
  id: typeof noProjectComboboxValue;
  label: typeof noProjectComboboxLabel;
  icon: ReactNode;
};

type ProjectSelectorItem =
  | ProjectSelectorProjectItem
  | ProjectSelectorNoProjectItem;

const noProjectComboboxItem: ProjectSelectorNoProjectItem = {
  type: "no-project",
  id: noProjectComboboxValue,
  label: noProjectComboboxLabel,
  icon: <FolderXIcon className="size-4 stroke-1" />,
};

export function ProjectSelector({
  projects,
  selectedProject,
  selectedProjectId,
  onClearProject,
  onSelectProject,
}: {
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedProjectId: string | null;
  onClearProject: () => void;
  onSelectProject: (projectId: string) => void;
}) {
  const items: ProjectSelectorItem[] = [
    ...projects.map(createProjectSelectorItem),
    noProjectComboboxItem,
  ];
  const value: ProjectSelectorItem | null = selectedProject
    ? createProjectSelectorItem(selectedProject)
    : selectedProjectId
      ? null
      : noProjectComboboxItem;

  return (
    <Combobox<ProjectSelectorItem>
      items={items}
      value={value}
      onValueChange={(item) => {
        if (item?.type === "project") {
          onSelectProject(item.project.id);
          return;
        }

        onClearProject();
      }}
      itemToStringLabel={getProjectSelectorInputLabel}
      itemToStringValue={(item) => item.id}
      isItemEqualToValue={(item, value) => item.id === value.id}
      filter={filterProjectSelectorItem}
    >
      <ComboboxInput
        icon={<FolderIcon className="size-4 stroke-1" />}
        iconAriaLabel="Open project selector"
        className="[&_[data-slot=input-group-control]]:max-w-64 [&_[data-slot=input-group-control]]:truncate"
        placeholder={projectComboboxPlaceholder}
      />
      <ComboboxContent className="min-w-64">
        <ComboboxList>
          {(item: ProjectSelectorItem) => (
            <Fragment key={item.id}>
              {item.type === "no-project" && projects.length > 0 ? (
                <ComboboxSeparator />
              ) : null}
              <ComboboxItem icon={item.icon} value={item}>
                <span title={getProjectSelectorItemLabel(item)}>
                  {getProjectSelectorItemLabel(item)}
                </span>
              </ComboboxItem>
            </Fragment>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function createProjectSelectorItem(
  project: ProjectSummary,
): ProjectSelectorProjectItem {
  return {
    type: "project",
    id: project.id,
    project,
  };
}

function getProjectSelectorItemLabel(item: ProjectSelectorItem) {
  return item.type === "project" ? item.project.name : item.label;
}

function getProjectSelectorInputLabel(item: ProjectSelectorItem) {
  return item.type === "no-project"
    ? projectComboboxPlaceholder
    : getProjectSelectorItemLabel(item);
}

function filterProjectSelectorItem(item: ProjectSelectorItem, query: string) {
  const normalizedQuery = normalizeProjectSelectorFilterText(query);

  if (!normalizedQuery) {
    return true;
  }

  const normalizedItemLabel = normalizeProjectSelectorFilterText(
    getProjectSelectorItemLabel(item),
  );
  const normalizedInputLabel = normalizeProjectSelectorFilterText(
    getProjectSelectorInputLabel(item),
  );

  return (
    normalizedItemLabel.includes(normalizedQuery) ||
    normalizedInputLabel.includes(normalizedQuery)
  );
}

function normalizeProjectSelectorFilterText(text: string) {
  return text.trim().toLocaleLowerCase();
}
