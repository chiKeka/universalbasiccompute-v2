/**
 * Resource catalog — two-tier system, domain-aware:
 * Tier 1: Detailed resource definitions (domains/{domain}/resources/*.yaml)
 * Tier 2: Bulk catalog (domains/{domain}/resources/catalog.yaml)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { domainResourcesDir } from "./domains.js";

/** Tier 1: Full resource definition with access guide and credential instructions */
export interface ResourceDefinition {
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

// Domain-keyed caches
const detailedCaches = new Map<string, ResourceDefinition[]>();
const bulkCaches = new Map<string, CatalogEntry[]>();

/** Clear caches for a domain (or all domains). */
export function clearCache(domain?: string): void {
  if (domain) {
    detailedCaches.delete(domain);
    bulkCaches.delete(domain);
  } else {
    detailedCaches.clear();
    bulkCaches.clear();
  }
}

/** Load Tier 1 detailed resource definitions for a domain. */
export function loadDetailedResources(domain: string = "compute"): ResourceDefinition[] {
  if (detailedCaches.has(domain)) return detailedCaches.get(domain)!;

  const dir = domainResourcesDir(domain);
  if (!existsSync(dir)) {
    detailedCaches.set(domain, []);
    return [];
  }

  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".yaml") && f !== "catalog.yaml"
  );
  const results: ResourceDefinition[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(dir, f), "utf-8");
      const parsed = parse(raw) as ResourceDefinition;
      if (parsed && parsed.name && parsed.category) {
        results.push(parsed);
      } else {
        console.error(`Skipping ${domain}/${f}: missing required fields (name, category)`);
      }
    } catch (err) {
      console.error(`Failed to parse ${domain}/${f}:`, err);
    }
  }
  detailedCaches.set(domain, results);
  return results;
}

/** Load Tier 2 bulk catalog for a domain. */
export function loadBulkCatalog(domain: string = "compute"): CatalogEntry[] {
  if (bulkCaches.has(domain)) return bulkCaches.get(domain)!;

  const catalogFile = join(domainResourcesDir(domain), "catalog.yaml");
  if (!existsSync(catalogFile)) {
    bulkCaches.set(domain, []);
    return [];
  }

  try {
    const raw = readFileSync(catalogFile, "utf-8");
    const entries = parse(raw) as Array<{
      name: string;
      provider: string;
      category: string;
      website: string;
      description: string;
      free_tier: string;
    }>;

    if (!Array.isArray(entries)) {
      console.error(`${domain}/catalog.yaml did not parse as an array`);
      bulkCaches.set(domain, []);
      return [];
    }

    const detailedNames = new Set(
      loadDetailedResources(domain).map((s) => s.name.toLowerCase())
    );

    const result = entries
      .filter((e) => e && e.name && e.category)
      .map((e) => ({
        ...e,
        has_detailed_guide: detailedNames.has(e.name.toLowerCase()),
      }));
    bulkCaches.set(domain, result);
  } catch (err) {
    console.error(`Failed to parse ${domain}/catalog.yaml:`, err);
    bulkCaches.set(domain, []);
  }

  return bulkCaches.get(domain)!;
}

/** Load ALL resources for a domain (both tiers merged). */
export function loadAllResources(domain: string = "compute"): CatalogEntry[] {
  const detailed = loadDetailedResources(domain);
  const bulk = loadBulkCatalog(domain);

  const result: CatalogEntry[] = detailed.map((s) => ({
    name: s.name,
    provider: s.provider,
    category: s.category,
    website: s.website,
    description: s.description,
    free_tier: s.free_tier.map((l) => `${l.name}: ${l.value} ${l.unit}`).join("; "),
    has_detailed_guide: true,
  }));

  const detailedNames = new Set(detailed.map((s) => s.name.toLowerCase()));
  for (const entry of bulk) {
    if (!detailedNames.has(entry.name.toLowerCase())) {
      result.push(entry);
    }
  }

  return result;
}

/** Get a detailed resource definition (Tier 1 only). */
export function loadResource(domain: string = "compute", name: string): ResourceDefinition | null {
  const resources = loadDetailedResources(domain);
  return (
    resources.find(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() ||
        s.provider.toLowerCase() === name.toLowerCase()
    ) ?? null
  );
}

/** Search across ALL resources for a domain (both tiers). */
export function searchResources(domain: string = "compute", query: string, category?: string): CatalogEntry[] {
  let all = loadAllResources(domain);
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

/** Get count by category for a domain. */
export function getCategoryCounts(domain: string = "compute"): Record<string, number> {
  const all = loadAllResources(domain);
  const counts: Record<string, number> = {};
  for (const s of all) {
    counts[s.category] = (counts[s.category] ?? 0) + 1;
  }
  return counts;
}
