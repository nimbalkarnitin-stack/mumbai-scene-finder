import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Live Music in Mumbai";
const DESC = "Indie rooms, jazz cellars and stages with something on tonight.";

export const Route = createFileRoute("/live-music")({
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="live-music" title={TITLE} description={DESC} category="live-music" />,
});
