import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Comedy in Mumbai";
const DESC = "Stand-up, open mics and comedy clubs worth the ticket.";

export const Route = createFileRoute("/comedy")({
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="comedy" title={TITLE} description={DESC} category="comedy" />,
});
