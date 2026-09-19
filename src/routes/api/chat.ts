import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, createLovableResponsesProvider, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai-gateway.server";
import { createPublicClient } from "@/lib/public-db.server";
import { fetchCityItems, getCityId, scoreItems } from "@/lib/recommend.server";
import { DEFAULT_CITY_SLUG } from "@/lib/scene-constants";

const SYSTEM = `You are SceneAI's concierge for Mumbai — a sharp, warm local friend who knows the city's bars, cafés, gigs, comedy rooms, restaurants and experiences.

HARD RULES
- Only recommend places, events and experiences returned by the search_listings tool. Never invent venues, event dates, showtimes, prices or availability. If the tool returns nothing suitable, say so plainly and suggest loosening a filter.
- Quote prices and times exactly as returned. If a listing has no price or time, say "price on request" / "check venue hours". Listings marked unverified should be flagged briefly ("details unverified").
- Clearly say "Sponsored" if an item is sponsored.
- Respond in concise markdown. For itineraries use a numbered timeline: **time — Place (Area)** then one line why it fits, plus an estimated cost line per stop and a total budget line at the end.
- When the user asks to modify a plan ("make it cheaper", "replace dinner", "add live music", "keep everything near Bandra", "make it more romantic"), re-run search_listings with adjusted filters and return the full updated itinerary, keeping stops that still fit.
- Link each recommendation as [Name](/v/slug) for venues, [Name](/e/slug) for events, [Name](/x/slug) for experiences.
- Currency is INR (₹). Keep answers under ~250 words unless building a full itinerary.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "AI is not configured yet." }, { status: 500 });

        const body = (await request.json()) as { messages: UIMessage[]; context?: Record<string, unknown> };
        const messages = body.messages ?? [];
        const ctx = body.context ?? {};

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const lovable = createLovableResponsesProvider(apiKey, runIdFetch);

        const db = createPublicClient();
        const cityId = await getCityId(db, (ctx["city"] as string) ?? DEFAULT_CITY_SLUG);

        const searchListings = tool({
          description: "Search SceneAI's verified Mumbai listings (venues, events, experiences) ranked by mood, budget, timing, area and group. Always call this before recommending anything.",
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
            if (!cityId) return { items: [], note: "City not configured" };
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
                sponsored: r.isSponsored, verified: r.isVerified, why: r.reasons, imageUrl: r.imageUrl,
              })),
              totalCandidates: items.length,
            };
          },
        });

        const listAreas = tool({
          description: "List Mumbai neighbourhoods SceneAI covers, with slugs.",
          inputSchema: z.object({}),
          execute: async () => {
            if (!cityId) return { areas: [] };
            const { data } = await db.from("areas").select("slug,name,zone").eq("city_id", cityId).eq("is_active", true);
            return { areas: data ?? [] };
          },
        });

        const contextLine = Object.keys(ctx).length ? `\n\nUser's current selections: ${JSON.stringify(ctx)}. Use them as defaults.` : "";

        try {
          const result = streamText({
            model: lovable.responses("openai/gpt-6-astra"),
            system: SYSTEM + contextLine,
            messages: await convertToModelMessages(messages),
            tools: { search_listings: searchListings, list_areas: listAreas },
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
                if (/402|credits/i.test(msg)) return "SceneAI's AI credits are exhausted. Please add credits to continue.";
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
