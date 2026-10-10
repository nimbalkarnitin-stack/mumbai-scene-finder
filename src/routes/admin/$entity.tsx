import { createFileRoute, notFound } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntityTable } from "@/components/admin/EntityTable";
import { ENTITIES } from "@/lib/admin-entities";

export const Route = createFileRoute("/admin/$entity")({ staticData: { sitemap: false },
  loader: ({ params }) => { if (!ENTITIES[params.entity]) throw notFound(); },
  notFoundComponent: () => <AdminShell title="Not found"><p className="text-sm text-muted-foreground">Unknown section.</p></AdminShell>,
  component: () => {
    const { entity } = Route.useParams();
    const def = ENTITIES[entity]!;
    return <AdminShell title={def.label}><EntityTable key={entity} def={def} /></AdminShell>;
  },
});
