import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { track } from "@/lib/track";
import type { ItemType } from "@/lib/scene-types";

const LS_KEY = "vybz.saved";
const LEGACY_LS_KEY = "sceneai.saved";
type Key = `${ItemType}:${string}`;

function readLocal(): Key[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(LS_KEY) ?? window.localStorage.getItem(LEGACY_LS_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw.filter((k) => typeof k === "string") as Key[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(keys: Key[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(Array.from(new Set(keys))));
    window.localStorage.removeItem(LEGACY_LS_KEY);
  } catch {
    /* storage unavailable */
  }
}

function parse(key: Key) {
  const [type, id] = key.split(":");
  return { type: type as ItemType, id: id ?? "" };
}

/** Saves live in the database when signed in, and on this device otherwise. */
export function useSaved() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Key[]>([]);

  useEffect(() => {
    if (!user) {
      setKeys(readLocal());
      return;
    }
    let cancelled = false;
    const sync = async () => {
      const { data, error } = await supabase.from("saved_items").select("item_type,item_id").eq("user_id", user.id);
      if (error || cancelled) return;
      const remote = (data ?? []).map((r) => `${r.item_type}:${r.item_id}` as Key);
      const local = readLocal();
      const pending = local.filter((k) => !remote.includes(k));
      const merged = new Set<Key>([...remote]);

      if (pending.length) {
        // Insert one row at a time so a single duplicate/invalid key can't lose the rest,
        // and only drop the local copy once the database has accepted it.
        const failed: Key[] = [];
        for (const key of pending) {
          const { type, id } = parse(key);
          if (!id) continue;
          const { error: insertError } = await supabase
            .from("saved_items")
            .upsert({ user_id: user.id, item_type: type, item_id: id }, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
          if (insertError) failed.push(key);
          else merged.add(key);
        }
        if (failed.length) {
          writeLocal(failed);
          toast("Some device saves couldn't sync", { description: "They're still saved on this device — we'll retry." });
        } else if (typeof window !== "undefined") {
          window.localStorage.removeItem(LS_KEY);
          window.localStorage.removeItem(LEGACY_LS_KEY);
        }
        failed.forEach((k) => merged.add(k));
      }
      if (!cancelled) setKeys(Array.from(merged));
    };
    void sync();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isSaved = useCallback((type: ItemType, id: string) => keys.includes(`${type}:${id}`), [keys]);

  const toggle = useCallback(
    async (type: ItemType, id: string) => {
      const key: Key = `${type}:${id}`;
      const adding = !keys.includes(key);
      const next = adding ? [...keys, key] : keys.filter((k) => k !== key);
      setKeys(next);
      track(adding ? "save" : "unsave", { itemType: type, itemId: id });
      if (user) {
        const { error } = adding
          ? await supabase.from("saved_items").upsert({ user_id: user.id, item_type: type, item_id: id }, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true })
          : await supabase.from("saved_items").delete().eq("user_id", user.id).eq("item_type", type).eq("item_id", id);
        if (error) {
          setKeys(keys);
          toast.error(adding ? "Couldn't save that — please try again." : "Couldn't remove that — please try again.");
        }
      } else {
        writeLocal(next);
        if (adding) toast("Saved on this device", { description: "Sign in to keep saves across devices." });
      }
    },
    [keys, user],
  );

  return { keys, isSaved, toggle };
}
