import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, createLovableResponsesProvider, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai-gateway.server";
import { classifyConciergeError, logConciergeError } from "@/lib/concierge-errors";
import { createPublicClient } from "@/lib/public-db.server";
import { fetchCityItems, getCityId, scoreItems } from "@/lib/recommend.server";
import { DEFAULT_CITY_SLUG } from "@/lib/scene-constants";

const SYSTEM = `You are vybz's concierge for Mumbai — a sharp, warm local friend who knows the city's bars, cafés, gigs, comedy rooms, restaurants and experiences.

HARD RULES
- Only recommend places, events and experiences returned by the search_listings tool. Never invent venues, event dates, showtimes, prices or availability. If the tool returns nothing suitable, say so plainly and suggest loosening a filter.
- The tool searches every ACTIVE listing in the catalogue. Some are editor-verified and some are not, so never claim the catalogue is verified-only. Prefer items with verified: true, and when you include an item with verified: false add "(details unverified — confirm with the venue)" right after it.
- Quote prices and times exactly as returned. If a listing has no price or time, say "price on request" / "check venue hours". Never state a date, time or price that is not in the tool output.
- Clearly say "Sponsored" if an item is sponsored.
- Respond in concise markdown. For itineraries use a numbered timeline: **time — Place (Area)** then one line why it fits, plus an estimated cost line per stop and a total budget line at the end.
- When the user asks to modify a plan ("make it cheaper", "replace dinner", "add live music", "keep everything near Bandra", "make it more romantic"), re-run search_listings with adjusted filters and return the full updated itinerary, keeping stops that still fit.
- Link each recommendation as [Name](/v/slug) for venues, [Name](/e/slug) for events, [Name](/x/slug) for experiences.
- For restaurant, café and nightlife reservations, send the user to the recommended venue page and tell them to use its Reserve action. The venue page checks live Swiggy Dineout availability, lets them choose guests/date/time, asks for confirmation, and returns the booking reference. Never claim a reservation is complete until Swiggy returns a confirmation.
- When no connected booking provider exists, say booking is unavailable in vybz and offer the source's booking options; never describe a generic website or map link as a reservation.
- Currency is INR (₹). Keep answers under ~250 words unless building a full itinerary.

FOOD DELIVERY
- For food delivery, dish, menu or "what can I order right now" questions, call search_food_delivery. It reads the user's own connected Swiggy session and only ever returns restaurants Swiggy reports as OPEN.
- If that tool reports notConnected, do not guess: say live delivery needs their Swiggy account connected, point them to the /food page, and answer from the vybz catalogue instead.
- Label live Swiggy results as "live from Swiggy" and never invent a delivery time, price, dish or availability. Swiggy live data is for this answer only — never present it as a vybz verified listing.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          const info = classifyConciergeError(new Error("Missing LOVABLE_API_KEY"));
          logConciergeError(info, "config");
          return Response.json({ error: info.userMessage, kind: info.kind }, { status: 500 });
        }

        let messages: UIMessage[] = [];
        let ctx: Record<string, unknown> = {};
        try {
          const body = (await request.json()) as { messages?: UIMessage[]; context?: Record<string, unknown> };
          if (!Array.isArray(body.messages)) throw new Error("validation: messages must be an array");
          messages = body.messages;
          ctx = body.context ?? {};
        } catch (err) {
          const info = classifyConciergeError(err);
          logConciergeError(info, "request_body");
          return Response.json({ error: info.userMessage, kind: info.kind }, { status: 400 });
        }

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const lovable = createLovableResponsesProvider(apiKey, runIdFetch);

        // The catalogue connection must never break the stream: tools degrade instead.
        let db: ReturnType<typeof createPublicClient> | null = null;
        let cityId: string | null = null;
        try {
          db = createPublicClient();
          cityId = await getCityId(db, (ctx["city"] as string) ?? DEFAULT_CITY_SLUG);
        } catch (err) {
          const info = classifyConciergeError(err);
          logConciergeError(info, "catalogue_init", runIdFetch.getRunId());
          db = null;
          cityId = null;
        }

        const searchListings = tool({
          description: "Search vybz's active Mumbai listings (venues, events, experiences) ranked by mood, budget, timing, area and group. Results mix editor-verified and unverified listings: each item carries a `verified` flag and an optional `sourceUrl`. Verified items rank higher; unverified items must be flagged when mentioned. Always call this before recommending anything.",
          inputSchema: z.object({
            mood: z.enum(["party", "romantic", "live-music", "comedy", "food", "outdoors", "chill", "something-new"]).nullable().describe("Primary mood"),
            group: z.enum(["solo", "couple", "friends", "family"]).nullable(),
            budget: z.number().nullable().describe("Max INR per person"),
            timing: z.enum(["tonight", "tomorrow", "saturday", "sunday", "weekend"]).nullable(),
            area: z.string().nullable().describe("Area slug e.g. bandra, lower-parel, colaba, andheri, juhu, khar, worli, powai, fort, marine-drive, bkc, versova"),
            category: z.string().nullable().describe("Category slug: restaurants, cafes, nightlife, live-music, comedy, experiences, outdoors, arts-culture"),
            limit: z.number().nullable(),
          }),
          execute: async (input) => {
            if (!db || !cityId) return { items: [], unavailable: true, note: "The vybz catalogue is unavailable right now. Tell the user you cannot list places at the moment and do not invent any." };
            try {
              const items = await fetchCityItems(db, cityId);
              const ranked = scoreItems(items, {
                mood: input.mood ?? undefined,
                group: input.group ?? undefined,
                budget: input.budget ?? undefined,
                timing: input.timing ?? undefined,
                area: input.area ?? undefined,
                category: input.category ?? undefined,
                limit: input.limit ?? 8,
              });
              return {
                items: ranked.map((r) => ({
                  id: r.id, type: r.type, slug: r.slug, name: r.name, category: r.categoryName, area: r.areaName,
                  priceMin: r.priceMin, priceMax: r.priceMax, startsAt: r.startsAt, scheduleNote: r.scheduleNote,
                  description: r.description?.slice(0, 160), moods: r.moods, bookingUrl: r.bookingUrl,
                  sponsored: r.isSponsored, verified: r.isVerified, sourceUrl: r.sourceUrl, lastUpdatedAt: r.updatedAt,
                  why: r.reasons, imageUrl: r.imageUrl,
                })),
                totalCandidates: items.length,
                verifiedCount: ranked.filter((r) => r.isVerified).length,
              };
            } catch (err) {
              // Controlled tool result — a catalogue fault must not kill the AI stream.
              const info = classifyConciergeError(err);
              logConciergeError(info, "tool:search_listings", runIdFetch.getRunId());
              return { items: [], unavailable: true, note: "The vybz catalogue could not be read for this search. Tell the user listings are temporarily unavailable and suggest trying again shortly. Do not invent listings." };
            }
          },
        });

        const listAreas = tool({
          description: "List Mumbai neighbourhoods vybz covers, with slugs.",
          inputSchema: z.object({}),
          execute: async () => {
            if (!db || !cityId) return { areas: [], unavailable: true };
            try {
              const { data, error } = await db.from("areas").select("slug,name,zone").eq("city_id", cityId).eq("is_active", true);
              if (error) throw new Error(error.message);
              return { areas: data ?? [] };
            } catch (err) {
              const info = classifyConciergeError(err);
              logConciergeError(info, "tool:list_areas", runIdFetch.getRunId());
              return { areas: [], unavailable: true };
            }
          },
        });

        // Live Swiggy tools act as the signed-in user, using their own MCP session.
        const authHeader = request.headers.get("authorization");
        const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        let swiggyUserId: string | null = null;
        if (bearer && bearer.split(".").length === 3) {
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const authClient = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data } = await authClient.auth.getClaims(bearer);
            swiggyUserId = (data?.claims?.sub as string | undefined) ?? null;
          } catch {
            swiggyUserId = null;
          }
        }

        const searchFoodDelivery = tool({
          description:
            "Search live Mumbai food-delivery restaurants and dishes from the signed-in user's own connected Swiggy account. Returns only restaurants Swiggy reports as OPEN right now, with whatever delivery time, distance and cost Swiggy supplies. Use for delivery, dish, menu and 'order now' questions. Never store or restate these results as vybz catalogue listings.",
          inputSchema: z.object({
            query: z.string().describe("What to search for, e.g. biryani, pizza, South Indian"),
            dish: z.boolean().nullable().describe("True to search dishes across restaurants instead of restaurants"),
          }),
          execute: async (input) => {
            if (!swiggyUserId) return { notConnected: true, reason: "not_signed_in" };
            try {
              const { callSwiggyTool } = await import("@/lib/swiggy/client.server");
              const protocol = await import("@/lib/swiggy/protocol");
              const addressesPayload = await callSwiggyTool({ userId: swiggyUserId, tool: "get_addresses", args: {} });
              const addresses = protocol.normaliseAddresses(addressesPayload);
              const addressId = addresses[0]?.id;
              if (!addressId) return { notConnected: false, noAddress: true };
              if (input.dish) {
                const payload = await callSwiggyTool({
                  userId: swiggyUserId,
                  tool: "search_menu",
                  args: protocol.searchMenuArgs({ addressId, query: input.query }),
                });
                const page = protocol.normaliseMenuPage(payload, 1);
                return { source: "swiggy_live", dishes: page.categories.slice(0, 6), fetchedAt: new Date().toISOString() };
              }
              const payload = await callSwiggyTool({
                userId: swiggyUserId,
                tool: "search_restaurants",
                args: protocol.searchRestaurantsArgs({ addressId, query: input.query }),
              });
              const page = protocol.normaliseRestaurantPage(payload);
              return {
                source: "swiggy_live",
                restaurants: protocol.openRestaurants(page.restaurants).slice(0, 8),
                fetchedAt: new Date().toISOString(),
              };
            } catch (err) {
              const cls = err && typeof err === "object" && "errorClass" in err ? String((err as { errorClass: unknown }).errorClass) : "UNKNOWN";
              if (cls === "NOT_CONNECTED" || cls === "SESSION_EXPIRED" || cls === "UNAUTHORIZED") return { notConnected: true, reason: cls };
              return { error: cls };
            }
          },
        });

        const contextLine = Object.keys(ctx).length ? `\n\nUser's current selections: ${JSON.stringify(ctx)}. Use them as defaults.` : "";

        try {
          const result = streamText({
            model: lovable.responses("openai/gpt-6-astra"),
            system: SYSTEM + contextLine,
            messages: await convertToModelMessages(messages),
            tools: { search_listings: searchListings, list_areas: listAreas, search_food_delivery: searchFoodDelivery },
            stopWhen: stepCountIs(50),
            abortSignal: request.signal,
            providerOptions: {
              openai: {
                store: false,
                include: ["reasoning.encrypted_content"],
                forceReasoning: true,
                reasoningEffort: "low",
                reasoningSummary: "auto",
              },
            },
          });
          return withLovableAiGatewayRunIdHeader(
            result.toUIMessageStreamResponse({
              originalMessages: messages,
              sendReasoning: true,
              onError: (err) => {
                const msg = err instanceof Error ? err.message : String(err);
                if (/402|credits/i.test(msg)) return "vybz's AI credits are exhausted. Please add credits to continue.";
                if (/429|rate/i.test(msg)) return "The concierge is busy — try again in a moment.";
                return "The concierge hit a snag. Please try again.";
              },
            }),
            runIdFetch,
          );
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return new Response(null, { status: 499 });
          throw err;
        }
      },
    },
  },
});
