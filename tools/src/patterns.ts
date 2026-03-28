/**
 * Pattern loader — reads assembly patterns from domains/{domain}/patterns/*.yaml
 *
 * A pattern is a known-good combination of resources that produces an outcome.
 * Previously called "recipes" — that name is kept as an alias for backward compat.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { domainPatternsDir } from "./domains.js";

export interface Pattern {
  id: string;
  name: string;
  description: string;
  icon?: string;
  // Supports both "resources" (new) and "services" (legacy compute recipes)
  resources?: Array<{ resource: string; role: string; reason: string }>;
  services?: Array<{ service: string; role: string; reason: string }>;
  builds?: {
    framework: string;
    features: string[];
    deploy_to: string;
  };
  outcome?: string;
  estimated_effort?: string;
  estimated_usage?: Record<string, string>;
}

// Domain-keyed cache
const caches = new Map<string, Pattern[]>();

/** Clear caches for a domain (or all domains). */
export function clearPatternCache(domain?: string): void {
  if (domain) {
    caches.delete(domain);
  } else {
    caches.clear();
  }
}

export function loadAllPatterns(domain: string = "compute"): Pattern[] {
  if (caches.has(domain)) return caches.get(domain)!;

  const dir = domainPatternsDir(domain);
  if (!existsSync(dir)) {
    caches.set(domain, []);
    return [];
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  const results: Pattern[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(dir, f), "utf-8");
      const parsed = parse(raw) as Pattern;
      if (parsed && parsed.id && parsed.name) {
        // Normalize: if legacy "services" field exists, map to "resources"
        if (parsed.services && !parsed.resources) {
          parsed.resources = parsed.services.map((s) => ({
            resource: s.service,
            role: s.role,
            reason: s.reason,
          }));
        }
        results.push(parsed);
      } else {
        console.error(`Skipping pattern ${domain}/${f}: missing required fields (id, name)`);
      }
    } catch (err) {
      console.error(`Failed to parse pattern ${domain}/${f}:`, err);
    }
  }
  caches.set(domain, results);
  return results;
}

export function loadPattern(domain: string = "compute", id: string): Pattern | null {
  const patterns = loadAllPatterns(domain);
  return patterns.find((r) => r.id === id) ?? null;
}
