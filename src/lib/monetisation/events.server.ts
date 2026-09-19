/** Server-side monetisation analytics, written to the existing interactions table. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type MonetisationEvent =
  | "affiliate_click"
  | "booking_start"
  | "conversion_received"
  | "commission_approved"
  | "commission_paid"
  | "sponsored_impression"
  | "sponsored_click";

export async function logMonetisationEvent(
  db: SupabaseClient<Database>,
  eventType: MonetisationEvent,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.from("interactions").insert({ event_type: eventType, metadata: metadata as never } as never);
  } catch {
    // Analytics must never break a monetisation flow.
  }
}
