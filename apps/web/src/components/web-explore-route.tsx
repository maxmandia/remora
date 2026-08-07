import { ExplorePage, type CreativeCategory } from "@remora/app/explore";
import { useNavigate } from "@tanstack/react-router";

export function WebExploreRoute({ category }: { category?: CreativeCategory }) {
  const navigate = useNavigate();

  function openCategory(nextCategory: CreativeCategory) {
    void navigate({
      to: "/explore/$category",
      params: { category: nextCategory },
    });
  }

  function openWorkspace() {
    void navigate({ to: "/app", search: {} });
  }

  return (
    <ExplorePage
      category={category}
      onBack={openWorkspace}
      onSelectCategory={openCategory}
      onStartCreating={openWorkspace}
    />
  );
}
