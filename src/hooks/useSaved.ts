import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { track } from "@/lib/track";
import type { ItemType } from "@/lib/scene-types";

const LS_KEY = "sceneai.saved";
type Key = `${ItemType}:${string}`;

function readLocal(): Key[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
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
    supabase.from("saved_items").select("item_type,item_id").eq("user_id", user.id).then(({ data }) => {
      const remote = (data ?? []).map((r) => `${r.item_type}:${r.item_id}` as Key);
      // merge local saves into account once
      const local = readLocal();
      const missing = local.filter((k) => !remote.includes(k));
      if (missing.length) {
        void supabase.from("saved_items").insert(missing.map((k) => { const [t, id] = k.split(":"); return { user_id: user.id, item_type: t as ItemType, item_id: id! }; })).then(() => window.localStorage.removeItem(LS_KEY));
      }
      setKeys([...remote, ...missing]);
    });
  }, [user]);

  const isSaved = useCallback((type: ItemType, id: string) => keys.includes(`${type}:${id}`), [keys]);

  const toggle = useCallback(
    async (type: ItemType, id: string) => {
      const key: Key = `${type}:${id}`;
      const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
      setKeys(next);
      const adding = next.includes(key);
      track(adding ? "save" : "unsave", { itemType: type, itemId: id });
      if (user) {
        if (adding) await supabase.from("saved_items").insert({ user_id: user.id, item_type: type, item_id: id });
        else await supabase.from("saved_items").delete().eq("user_id", user.id).eq("item_type", type).eq("item_id", id);
      } else {
        window.localStorage.setItem(LS_KEY, JSON.stringify(next));
        if (adding) toast("Saved on this device", { description: "Sign in to keep saves across devices." });
      }
    },
    [keys, user],
  );

  return { keys, isSaved, toggle };
}
