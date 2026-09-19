import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Experiences in Mumbai";
const DESC = "Walks, workshops, tours and things to try this weekend.";

export const Route = createFileRoute("/experiences")({
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="experiences" title={TITLE} description={DESC} type="experience" />,
});
