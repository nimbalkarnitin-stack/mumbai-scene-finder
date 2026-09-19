import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Restaurants in Mumbai";
const DESC = "From coastal thalis to tasting menus — where to eat in Mumbai tonight.";

export const Route = createFileRoute("/restaurants")({
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="restaurants" title={TITLE} description={DESC} category="restaurants" />,
});
