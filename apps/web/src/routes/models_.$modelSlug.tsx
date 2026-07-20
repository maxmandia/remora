import { createFileRoute, notFound } from "@tanstack/react-router";

import { ModelPage } from "../components/model-page";
import {
  getPublishedModelPageComponent,
  preloadPublishedModelPage,
} from "../lib/seo/model-pages";
import { createModelPageHead } from "../lib/seo";

export const Route = createFileRoute("/models_/$modelSlug")({
  loader: async ({ params }) => {
    const metadata = await preloadPublishedModelPage(params.modelSlug);
    if (!metadata) {
      throw notFound();
    }

    return metadata;
  },
  head: ({ loaderData }) => (loaderData ? createModelPageHead(loaderData) : {}),
  component: ModelRoute,
});

function ModelRoute() {
  const metadata = Route.useLoaderData();
  const Content = getPublishedModelPageComponent(metadata.slug);

  if (!Content) {
    return null;
  }

  return <ModelPage Content={Content} metadata={metadata} />;
}
