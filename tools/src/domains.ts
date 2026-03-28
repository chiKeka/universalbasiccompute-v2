/**
 * Domain management — discovers, loads, and scaffolds UBC domains.
 *
 * Each domain is a directory under /domains/ containing:
 *   domain.yaml       — descriptor (id, name, description, categories)
 *   resources/         — resource catalog + detailed guides
 *   patterns/          — assembly patterns
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAINS_DIR = join(__dirname, "..", "..", "domains");

export interface DomainDescriptor {
  id: string;
  name: string;
  description: string;
  version?: string;
  created_at?: string;
  categories?: string[];
  resource_types?: string[];
  access_types?: string[];
  assembly_verbs?: string[];
  outcome_types?: string[];
  maintainer?: string;
}

export function domainsDir(): string {
  return DOMAINS_DIR;
}

export function domainDir(domain: string): string {
  return join(DOMAINS_DIR, domain);
}

export function domainResourcesDir(domain: string): string {
  return join(DOMAINS_DIR, domain, "resources");
}

export function domainPatternsDir(domain: string): string {
  return join(DOMAINS_DIR, domain, "patterns");
}

/** List all registered domains by scanning domains/ subdirectories. */
export function listDomains(): DomainDescriptor[] {
  if (!existsSync(DOMAINS_DIR)) return [];

  return readdirSync(DOMAINS_DIR)
    .filter((d) => {
      const p = join(DOMAINS_DIR, d);
      return statSync(p).isDirectory() && existsSync(join(p, "domain.yaml"));
    })
    .map((d) => {
      try {
        const raw = readFileSync(join(DOMAINS_DIR, d, "domain.yaml"), "utf-8");
        return parse(raw) as DomainDescriptor;
      } catch {
        return { id: d, name: d, description: "Failed to load domain descriptor" };
      }
    });
}

/** Load a specific domain descriptor. */
export function getDomain(id: string): DomainDescriptor | null {
  const file = join(DOMAINS_DIR, id, "domain.yaml");
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf-8");
    return parse(raw) as DomainDescriptor;
  } catch {
    return null;
  }
}

/** Validate that a domain exists. Returns the id (normalized) or null. */
export function validateDomain(domain: string): string | null {
  const dir = join(DOMAINS_DIR, domain);
  if (existsSync(dir) && existsSync(join(dir, "domain.yaml"))) {
    return domain;
  }
  return null;
}

/** Scaffold a new empty domain. Creates directory structure + domain.yaml. */
export function scaffoldDomain(
  id: string,
  name: string,
  description: string,
  categories?: string[],
  resourceTypes?: string[],
  accessTypes?: string[],
  assemblyVerbs?: string[],
  outcomeTypes?: string[]
): DomainDescriptor {
  const dir = join(DOMAINS_DIR, id);
  const resourcesDir = join(dir, "resources");
  const patternsDir = join(dir, "patterns");

  mkdirSync(resourcesDir, { recursive: true });
  mkdirSync(patternsDir, { recursive: true });

  const descriptor: DomainDescriptor = {
    id,
    name,
    description,
    version: "0.1.0",
    created_at: new Date().toISOString().split("T")[0],
    categories: categories ?? [],
    resource_types: resourceTypes ?? [],
    access_types: accessTypes ?? [],
    assembly_verbs: assemblyVerbs ?? [],
    outcome_types: outcomeTypes ?? [],
    maintainer: "discovery",
  };

  writeFileSync(join(dir, "domain.yaml"), stringify(descriptor), "utf-8");

  // Create empty catalog
  writeFileSync(join(resourcesDir, "catalog.yaml"), "# Resources will be added by the discovery agent\n[]", "utf-8");

  return descriptor;
}
