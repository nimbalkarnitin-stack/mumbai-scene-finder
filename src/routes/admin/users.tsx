import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/users")({ staticData: { sitemap: false }, component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name,membership_tier,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (error) throw error;
      const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles ?? []).map((p) => ({ ...p, isAdmin: admins.has(p.id) }));
    },
  });
  const toggleAdmin = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const res = isAdmin
        ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin")
        : await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
      if (res.error) throw res.error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setTier = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string }) => { const { error } = await supabase.from("profiles").update({ membership_tier: tier }).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Users">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Tier</th><th className="px-3 py-2.5">Joined</th><th className="px-3 py-2.5">Role</th></tr></thead>
          <tbody>
            {q.data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.email ?? "—"}</td>
                <td className="px-3 py-2">{u.display_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <select value={u.membership_tier} onChange={(e) => setTier.mutate({ id: u.id, tier: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                    <option value="free">free</option><option value="plus">plus</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-3 py-2"><Button size="sm" variant={u.isAdmin ? "ember" : "glass"} onClick={() => toggleAdmin.mutate({ id: u.id, isAdmin: u.isAdmin })}>{u.isAdmin ? "Admin" : "Make admin"}</Button></td>
              </tr>
            ))}
            {q.data?.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No users yet.</td></tr>}
            {q.error && <tr><td colSpan={5} className="px-3 py-8 text-center text-destructive">{(q.error as Error).message}</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
