import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { EntityDef, FieldDef } from "@/lib/admin-entities";

type Row = Record<string, unknown> & { id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => supabase.from(name as any) as any;

function useOptions(source: string | undefined) {
  return useQuery({
    queryKey: ["admin-options", source],
    enabled: !!source && source !== "item_type",
    queryFn: async () => {
      const col = source === "affiliate_links" ? "partner_name" : source === "categories" || source === "areas" || source === "sponsors" || source === "venues" ? "name" : "name";
      const { data } = await table(source!).select(`id,${col}`).order(col).limit(500);
      return ((data ?? []) as Record<string, string>[]).map((r) => ({ id: r["id"]!, label: r[col]! }));
    },
  });
}

function Field({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const opts = useOptions(f.options);
  const cls = "h-10 rounded-xl bg-background/60";
  switch (f.kind) {
    case "textarea": return <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} rows={f.key === "body" ? 10 : 3} className="rounded-xl bg-background/60" />;
    case "number": return <Input type="number" step="any" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cls} />;
    case "boolean": return <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />{value ? "Yes" : "No"}</label>;
    case "datetime": return <Input type="datetime-local" value={toIstInput(value as string | null)} onChange={(e) => onChange(fromIstInput(e.target.value))} className={cls} />;
    case "list": return <Input value={Array.isArray(value) ? (value as string[]).join(", ") : ""} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="comma, separated" className={cls} />;
    case "json": return <Textarea value={value ? JSON.stringify(value, null, 2) : ""} onChange={(e) => { try { onChange(e.target.value ? JSON.parse(e.target.value) : null); } catch { /* keep typing */ } }} rows={4} className="rounded-xl bg-background/60 font-mono text-xs" />;
    case "select":
      if (f.options === "item_type") return (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${cls} w-full border border-input px-3 text-sm`}>
          <option value="">—</option><option value="venue">Venue</option><option value="event">Event</option><option value="experience">Experience</option>
        </select>
      );
      return (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={`${cls} w-full border border-input px-3 text-sm`}>
          <option value="">—</option>
          {(opts.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    default: return <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cls} />;
  }
}

const IST_OFFSET = "+05:30";

/** Datetime inputs are always entered and shown in Mumbai time (Asia/Kolkata). */
function toIstInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => { acc[x.type] = x.value; return acc; }, {});
  return `${p["year"]}-${p["month"]}-${p["day"]}T${p["hour"] === "24" ? "00" : p["hour"]}:${p["minute"]}`;
}
function fromIstInput(local: string) {
  if (!local) return null;
  const d = new Date(`${local}:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function cell(v: unknown) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return <span className={v ? "text-teal" : "text-muted-foreground"}>{v ? "Yes" : "No"}</span>;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return String(v);
}

export function EntityTable({ def }: { def: EntityDef }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["admin", def.table],
    queryFn: async () => {
      const { data, error } = await table(def.table).select("*").order(def.orderBy, { ascending: false }).limit(500);
      if (error) throw error;
      return data as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const { id, ...rest } = row;
      const payload = Object.fromEntries(Object.entries(rest).filter(([k]) => !["created_at", "updated_at"].includes(k)));
      const res = id ? await table(def.table).update(payload).eq("id", id) : await table(def.table).insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", def.table] }); setEditing(null); setErrors({}); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const validate = (row: Row) => {
    const errs: Record<string, string> = {};
    for (const f of def.fields) {
      const v = row[f.key];
      if (f.required && isEmpty(v)) errs[f.key] = `${f.label} is required`;
      if (f.key === "slug" && typeof v === "string" && v && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) errs[f.key] = "Use lowercase letters, numbers and dashes only";
      if (f.kind === "number" && v != null && Number.isNaN(Number(v))) errs[f.key] = `${f.label} must be a number`;
    }
    const min = row["price_min"] as number | null, max = row["price_max"] as number | null;
    if (min != null && max != null && Number(max) < Number(min)) errs["price_max"] = "Price max cannot be lower than price min";
    const starts = row["starts_at"] as string | null, ends = row["ends_at"] as string | null;
    if (starts && ends && new Date(ends) <= new Date(starts)) errs["ends_at"] = "End time must be after the start time";
    return errs;
  };

  const submit = (row: Row) => {
    const errs = validate(row);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(`Fix ${Object.keys(errs).length} field${Object.keys(errs).length === 1 ? "" : "s"} before saving`);
      return;
    }
    save.mutate(row);
  };
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await table(def.table).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", def.table] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []).filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="mb-4 flex gap-2">
        <Input placeholder={`Search ${def.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 max-w-xs rounded-xl bg-card" />
        <Button variant="ember" onClick={() => setEditing({ id: "", ...(def.defaults ?? {}) } as Row)}><Plus className="size-4" />New {def.singular.toLowerCase()}</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>{def.listCols.map((c) => <th key={c} className="px-3 py-2.5">{c.replace(/_/g, " ")}</th>)}<th className="px-3 py-2.5" /></tr>
          </thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={def.listCols.length + 1} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {list.error && <tr><td colSpan={def.listCols.length + 1} className="px-3 py-8 text-center text-destructive">{(list.error as Error).message}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-card/60">
                {def.listCols.map((c) => <td key={c} className="max-w-[240px] truncate px-3 py-2">{cell(r[c])}</td>)}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="size-3.5" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Delete this ${def.singular.toLowerCase()}?`) && remove.mutate(r.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {list.data && rows.length === 0 && <tr><td colSpan={def.listCols.length + 1} className="px-3 py-8 text-center text-muted-foreground">No {def.label.toLowerCase()} yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setErrors({}); } }}>
        <SheetContent className="w-full overflow-y-auto border-border bg-background sm:max-w-lg">
          <SheetHeader><SheetTitle>{editing?.id ? `Edit ${def.singular.toLowerCase()}` : `New ${def.singular.toLowerCase()}`}</SheetTitle></SheetHeader>
          {editing && (
            <form className="space-y-4 px-4 pb-8" onSubmit={(e) => { e.preventDefault(); submit(editing); }} noValidate>
              {Object.keys(errors).length > 0 && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">Please fix the highlighted fields.</p>
              )}
              {def.fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}{f.required && " *"}</label>
                  <Field f={f} value={editing[f.key]} onChange={(v) => { setEditing({ ...editing, [f.key]: v }); setErrors((e) => { const { [f.key]: _drop, ...rest } = e; return rest; }); }} />
                  {errors[f.key] && <p className="mt-1 text-[11px] text-destructive">{errors[f.key]}</p>}
                  {f.kind === "datetime" && <p className="mt-1 text-[11px] text-muted-foreground">Entered and shown in Mumbai time (IST).</p>}
                  {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
                </div>
              ))}
              <Button type="submit" variant="ember" className="w-full" disabled={save.isPending}>Save</Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
