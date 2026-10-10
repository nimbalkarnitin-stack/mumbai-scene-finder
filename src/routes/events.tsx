import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage, categoryHead } from "@/components/scene/CategoryPage";

const TITLE = "Events in Mumbai";
const DESC = "Gigs, comedy nights, pop-ups and one-off happenings across Mumbai — soonest first.";

export const Route = createFileRoute("/events")({ staticData: { sitemap: true },
  head: categoryHead(TITLE, DESC),
  component: () => <CategoryPage slug="events" title={TITLE} description={DESC} type="event" sort="soonest" />,
});
