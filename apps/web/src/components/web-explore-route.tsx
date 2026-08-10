import {
  ExplorePage,
  type CreativeCategory,
  type ExploreVhsTapeKey,
} from "@remora/app/explore";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";

export function WebExploreRoute({ category }: { category?: CreativeCategory }) {
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const router = useRouter();

  function openCategory(nextCategory: CreativeCategory) {
    void navigate({
      to: "/explore/$category",
      params: { category: nextCategory },
    });
  }

  function openWorkspace() {
    void navigate({ to: "/app", search: {} });
  }

  function tryPrompt(exploreRef: ExploreVhsTapeKey) {
    void navigate({ to: "/app", search: { exploreRef } });
  }

  function goBack() {
    if (canGoBack) {
      router.history.back();
      return;
    }

    openWorkspace();
  }

  return (
    <ExplorePage
      category={category}
      onBack={goBack}
      onSelectCategory={openCategory}
      onStartCreating={openWorkspace}
      onTryPrompt={tryPrompt}
    />
  );
}
