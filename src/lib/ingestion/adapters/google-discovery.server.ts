import { AdapterDisabledError, type SourceAdapter } from "./types";

/**
 * Google is a DISCOVERY source, not a catalogue source: it never produces listing records.
 * It runs through the discovery task (`runGoogleDiscovery`), which stores candidate names and
 * their own website links so the official-source resolver can find first-party pages.
 * Registering it here keeps the orchestrator from ever treating it as a content feed.
 */
export const googleDiscoveryAdapter: SourceAdapter = {
  key: "google_discovery",
  requiredEnv: ["GOOGLE_PLACES_API_KEY"],

  async fetch() {
    throw new AdapterDisabledError(
      "Google is a discovery-only source: it identifies candidate venues and their official websites. Run it from Admin → Discovery, not the catalogue ingestion pipeline.",
    );
  },
  parse() {
    return null;
  },
  normalise() {
    return null;
  },
  getExternalId() {
    return "";
  },
  getSourceUrl() {
    return null;
  },
  getLastModified() {
    return null;
  },
};
