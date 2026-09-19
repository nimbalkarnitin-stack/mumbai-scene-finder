import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Cafés in Mumbai";
const DESC = "Irani classics, specialty coffee and slow afternoons across the city.";

export const Route = createFileRoute("/cafes")({
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="cafes" title={TITLE} description={DESC} category="cafes" />,
});
