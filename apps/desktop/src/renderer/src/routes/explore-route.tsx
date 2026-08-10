import { useAuth } from "@remora/app/auth";
import {
  ExplorePage,
  isCreativeCategory,
  type CreativeCategory,
  type ExploreVhsTapeKey,
} from "@remora/app/explore";
import {
  Navigate,
  useCanGoBack,
  useNavigate,
  useParams,
  useRouter,
} from "@tanstack/react-router";

import { BlankRouteSurface } from "./blank-route-surface.tsx";

export function ExploreRoute() {
  const { status, user } = useAuth();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const router = useRouter();
  const { category: requestedCategory } = useParams({ strict: false });

  if (status === "loading") {
    return <BlankRouteSurface status={status} user={user} />;
  }

  if (status === "signed-out") {
    return <Navigate replace to="/welcome" />;
  }

  if (
    typeof requestedCategory === "string" &&
    !isCreativeCategory(requestedCategory)
  ) {
    return <Navigate replace to="/explore" />;
  }

  const category =
    typeof requestedCategory === "string" ? requestedCategory : undefined;

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
