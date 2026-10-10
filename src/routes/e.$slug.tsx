import { createFileRoute } from "@tanstack/react-router";
import { ItemPage, makeItemRoute } from "@/lib/item-route";

export const Route = createFileRoute("/e/$slug")({ staticData: { sitemap: false },
  ...makeItemRoute("event"),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  return <ItemPage type="event" slug={slug} />;
}
