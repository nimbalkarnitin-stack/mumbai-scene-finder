import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { disconnectSwiggy, enrichVenuesWithSwiggy, getSwiggyStatus, listSwiggyAddresses, startSwiggyConnect } from "@/lib/swiggy/swiggy.functions";
import { useAuth } from "./useAuth";


/**
 * Swiggy delivery address for the current browsing session only.
 * Kept in sessionStorage — never written to My Mood's database, per Swiggy's data rules.
 */
const ADDRESS_KEY = "mymood.swiggy.addressId";

export function useSwiggyAddressId() {
  const [addressId, setAddressId] = useState<string | null>(null);
  useEffect(() => {
    setAddressId(sessionStorage.getItem(ADDRESS_KEY));
  }, []);
  const select = useCallback((id: string | null) => {
    if (id) sessionStorage.setItem(ADDRESS_KEY, id);
    else sessionStorage.removeItem(ADDRESS_KEY);
    setAddressId(id);
  }, []);
  return { addressId, select };
}

/** Human wording for the error classes the server layer passes through. */
export function swiggyErrorMessage(error: unknown): { message: string; needsReconnect: boolean } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const cls = raw.split(":")[0] ?? "";
  const needsReconnect = cls === "NOT_CONNECTED" || cls === "SESSION_EXPIRED" || cls === "UNAUTHORIZED";
  if (cls === "NOT_CONNECTED") return { message: "Connect your Swiggy account to see live delivery options.", needsReconnect };
  if (cls === "SESSION_EXPIRED" || cls === "UNAUTHORIZED") return { message: "Your Swiggy session has ended. Please reconnect to continue.", needsReconnect };
  if (cls === "FORBIDDEN") return { message: "Swiggy declined this request for your account.", needsReconnect };
  if (cls === "UPSTREAM_ERROR" || cls === "TRANSPORT_ERROR") return { message: "Swiggy is not responding right now. Please try again in a moment.", needsReconnect };
  return { message: raw.replace(/^[A-Z_]+:\s*/, "") || "Something went wrong with Swiggy.", needsReconnect };
}

export function useSwiggyConnection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["swiggy-status", user?.id ?? null],
    queryFn: () => getSwiggyStatus(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const connect = useMutation({
    mutationFn: (returnPath: string) => startSwiggyConnect({ data: { returnPath } }),
    onSuccess: (data) => {
      window.location.href = data.authorizeUrl;
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectSwiggy(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["swiggy-status"] });
      sessionStorage.removeItem(ADDRESS_KEY);
    },
  });

  return { signedIn: !!user, status, connect, disconnect };
}

export function useSwiggyAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ["swiggy-addresses"],
    queryFn: () => listSwiggyAddresses(),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * Live delivery context for recommendation cards — a secondary signal only.
 * Runs solely for a connected user with a chosen address; anything else returns no live data,
 * and canonical My Mood facts stay untouched. Nothing is persisted.
 */
export function useSwiggyLiveVenues(venues: { id: string; name: string }[]) {
  const { user } = useAuth();
  const { status } = useSwiggyConnection();
  const { addressId } = useSwiggyAddressId();
  const connected = !!user && !!status.data?.connected && !!addressId;
  const shortlist = venues.slice(0, 6);
  const key = shortlist.map((v) => v.id).join(",");

  const q = useQuery({
    queryKey: ["swiggy-live-venues", addressId, key],
    queryFn: () => enrichVenuesWithSwiggy({ data: { addressId: addressId!, venues: shortlist } }),
    enabled: connected && shortlist.length > 0,
    retry: false,
    staleTime: 2 * 60_000,
  });

  return { live: q.data?.live ?? {}, fetchedAt: q.data?.fetchedAt ?? null, connected };
}

