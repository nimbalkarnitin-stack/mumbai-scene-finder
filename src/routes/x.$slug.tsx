import { createFileRoute } from "@tanstack/react-router";
import { ItemPage, makeItemRoute } from "@/lib/item-route";

export const Route = createFileRoute("/x/$slug")({
  ...makeItemRoute("experience"),
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  return <ItemPage type="experience" slug={slug} />;
}
