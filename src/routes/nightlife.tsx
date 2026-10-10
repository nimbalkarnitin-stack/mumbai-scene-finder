import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Mumbai Nightlife";
const DESC = "Rooftops, basements, clubs and late bars from Bandra to Lower Parel.";

export const Route = createFileRoute("/nightlife")({ staticData: { sitemap: true },
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="nightlife" title={TITLE} description={DESC} category="nightlife" />,
});
