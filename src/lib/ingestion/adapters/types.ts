import type { NormalisedRecord, SourceType } from "../types";

export interface SourceRow {
  id: string;
  slug: string;
  name: string;
  source_type: SourceType;
  adapter_key: string;
  base_url: string | null;
  enabled: boolean;
  authority_level: number;
  refresh_interval_minutes: number;
  requires_credentials: boolean;
  credential_env_keys: string[];
  config: Record<string, unknown>;
  city_id: string | null;
}

export interface AdapterContext {
  source: SourceRow;
  now: Date;
  log: (message: string) => void;
}

/** One item exactly as it came off the wire, plus where it came from. */
export interface RawItem {
  raw: Record<string, unknown>;
  sourceUrl: string | null;
}

export type ParsedItem = Record<string, unknown> & { __sourceUrl?: string | null };

export class AdapterDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterDisabledError";
  }
}

export interface SourceAdapter {
  key: string;
  /** Env var names that must be present for this adapter to run at all. */
  requiredEnv: string[];
  /** Pull raw payloads from the source. Must throw AdapterDisabledError when not configured. */
  fetch(ctx: AdapterContext): Promise<RawItem[]>;
  /** Shape a raw payload into a flat parsed object, or null when it isn't a usable record. */
  parse(item: RawItem, ctx: AdapterContext): ParsedItem | null;
  /** Map a parsed object onto the catalogue draft shape. Unknown facts stay null. */
  normalise(parsed: ParsedItem, ctx: AdapterContext): NormalisedRecord | null;
  getExternalId(parsed: ParsedItem, ctx: AdapterContext): string;
  getSourceUrl(parsed: ParsedItem, ctx: AdapterContext): string | null;
  getLastModified(parsed: ParsedItem, ctx: AdapterContext): string | null;
}

export function missingEnv(keys: string[]): string[] {
  return keys.filter((k) => !process.env[k]);
}
