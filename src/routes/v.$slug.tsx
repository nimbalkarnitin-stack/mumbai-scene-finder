import { createFileRoute } from "@tanstack/react-router";
import { ItemPage, makeItemRoute } from "@/lib/item-route";

export const Route = createFileRoute("/v/$slug")({ staticData: { sitemap: false },
  ...makeItemRoute("venue"),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  return <ItemPage type="venue" slug={slug} />;
}
