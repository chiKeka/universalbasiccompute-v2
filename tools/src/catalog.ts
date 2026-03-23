/**
 * Service catalog — two-tier system:
 * Tier 1: Detailed service definitions (/services/*.yaml) — 10 services with full guides
 * Tier 2: Bulk catalog (/services/catalog.yaml) — 400+ services with basic info
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICES_DIR = join(__dirname, "..", "..", "services");
const CATALOG_FILE = join(SERVICES_DIR, "catalog.yaml");

/** Tier 1: Full service definition with signup guide and credential instructions */
export interface ServiceDefinition {
  name: string;
  provider: string;
  category: string;
  website: string;
  pricing_url: string;
  description: string;
  free_tier: Array<{ name: string; value: number; unit: string; notes?: string }>;
  signup: {
    url: string;
    method: string;
    requires?: string;
    steps: string[];
  };
  credentials: Array<{
    name: string;
    env_var: string;
    type: string;
    optional?: boolean;
    sensitive?: boolean;
    how_to_get: { url: string; steps: string[] };
    validation: string;
  }>;
  provides: string[];
  depends_on: string[];
}

/** Tier 2: Lightweight catalog entry */
export interface CatalogEntry {
  name: string;
  provider: string;
  category: string;
  website: string;
  description: string;
  free_tier: string;
  has_detailed_guide: boolean;
}

let detailedCache: ServiceDefinition[] | null = null;
let bulkCache: CatalogEntry[] | null = null;

/** Load Tier 1 detailed service definitions (individual YAML files) */
export function loadDetailedServices(): ServiceDefinition[] {
  if (detailedCache) return detailedCache;

  const files = readdirSync(SERVICES_DIR).filter(
    (f) => f.endsWith(".yaml") && f !== "catalog.yaml"
  );
  detailedCache = files.map((f) => {
    const raw = readFileSync(join(SERVICES_DIR, f), "utf-8");
    return parse(raw) as ServiceDefinition;
  });
  return detailedCache;
}

/** Load Tier 2 bulk catalog */
export function loadBulkCatalog(): CatalogEntry[] {
  if (bulkCache) return bulkCache;

  if (!existsSync(CATALOG_FILE)) {
    bulkCache = [];
    return bulkCache;
  }

  const raw = readFileSync(CATALOG_FILE, "utf-8");
  const entries = parse(raw) as Array<{
    name: string;
    provider: string;
    category: string;
    website: string;
    description: string;
    free_tier: string;
  }>;

  const detailedNames = new Set(
    loadDetailedServices().map((s) => s.name.toLowerCase())
  );

  bulkCache = entries.map((e) => ({
    ...e,
    has_detailed_guide: detailedNames.has(e.name.toLowerCase()),
  }));

  return bulkCache;
}

/** Load ALL services (both tiers merged, Tier 1 enriched with guide flag) */
export function loadAllServices(): CatalogEntry[] {
  const detailed = loadDetailedServices();
  const bulk = loadBulkCatalog();

  // Start with detailed services (marked as having guides)
  const result: CatalogEntry[] = detailed.map((s) => ({
    name: s.name,
    provider: s.provider,
    category: s.category,
    website: s.website,
    description: s.description,
    free_tier: s.free_tier.map((l) => `${l.name}: ${l.value} ${l.unit}`).join("; "),
    has_detailed_guide: true,
  }));

  // Add bulk entries that don't have detailed guides
  const detailedNames = new Set(detailed.map((s) => s.name.toLowerCase()));
  for (const entry of bulk) {
    if (!detailedNames.has(entry.name.toLowerCase())) {
      result.push(entry);
    }
  }

  return result;
}

/** Get a detailed service definition (Tier 1 only) */
export function loadService(name: string): ServiceDefinition | null {
  const services = loadDetailedServices();
  return (
    services.find(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() ||
        s.provider.toLowerCase() === name.toLowerCase()
    ) ?? null
  );
}

/** Search across ALL services (both tiers) */
export function searchServices(query: string, category?: string): CatalogEntry[] {
  let all = loadAllServices();
  if (category) {
    all = all.filter((s) => s.category === category);
  }
  if (query) {
    const q = query.toLowerCase();
    all = all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }
  return all;
}

/** Get count by category */
export function getCategoryCounts(): Record<string, number> {
  const all = loadAllServices();
  const counts: Record<string, number> = {};
  for (const s of all) {
    counts[s.category] = (counts[s.category] ?? 0) + 1;
  }
  return counts;
}
