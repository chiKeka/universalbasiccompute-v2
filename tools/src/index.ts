#!/usr/bin/env node
/**
 * UBC MCP Tools Server — Domain-Agnostic Protocol
 *
 * Exposes UBC capabilities to any agent platform via MCP.
 * All tools accept an optional `domain` parameter (defaults to "compute").
 *
 * Run with: npx tsx tools/src/index.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadAllResources, loadResource, searchResources, getCategoryCounts, clearCache } from "./catalog.js";
import { loadAllPatterns, loadPattern, clearPatternCache } from "./patterns.js";
import { getState, updateResourceStatus, setActivePattern, setProjectStatus, type UBCState } from "./state.js";
import { storeAccess, getAccess } from "./access.js";
import { listDomains, getDomain, scaffoldDomain, validateDomain } from "./domains.js";

const server = new McpServer({
  name: "ubc-tools",
  version: "0.3.0",
});

// ── Domain Tools ──────────────────────────────────────

server.tool(
  "ubc_domains",
  "List all available UBC domains. Each domain is a category of free resources (compute, education, etc.).",
  {},
  async () => {
    const domains = listDomains();
    return { content: [{ type: "text", text: JSON.stringify(domains, null, 2) }] };
  }
);

server.tool(
  "ubc_create_domain",
  "Scaffold a new domain. Creates the directory structure and domain.yaml so the discovery agent can populate it with resources and patterns.",
  {
    id: z.string().describe("Domain slug (e.g., 'education', 'health', 'finance')"),
    name: z.string().describe("Human-readable name"),
    description: z.string().describe("What this domain covers"),
    categories: z.array(z.string()).optional().describe("Resource categories within this domain"),
    resource_types: z.array(z.string()).optional().describe("Kinds of resources (course, service, tool, etc.)"),
    access_types: z.array(z.string()).optional().describe("How access is granted (api_key, enrollment, open, etc.)"),
    assembly_verbs: z.array(z.string()).optional().describe("Actions agents perform (provision, enroll, build, etc.)"),
    outcome_types: z.array(z.string()).optional().describe("What gets produced (deployed_app, learning_path, etc.)"),
  },
  async ({ id, name, description, categories, resource_types, access_types, assembly_verbs, outcome_types }) => {
    if (validateDomain(id)) {
      return { content: [{ type: "text", text: `Domain "${id}" already exists.` }], isError: true };
    }
    const domain = scaffoldDomain(id, name, description, categories, resource_types, access_types, assembly_verbs, outcome_types);
    return { content: [{ type: "text", text: `Created domain "${id}":\n${JSON.stringify(domain, null, 2)}\n\nDirectories created:\n  domains/${id}/resources/\n  domains/${id}/patterns/\n\nThe discovery agent can now populate this domain with resources and patterns.` }] };
  }
);

// ── Catalog Tools ──────────────────────────────────────

server.tool(
  "ubc_catalog",
  "Browse the UBC resource catalog. Filter by category or search by name/description. Defaults to the 'compute' domain.",
  {
    domain: z.string().default("compute").describe("Domain to browse (e.g., 'compute', 'education')"),
    category: z.string().optional().describe("Filter by category"),
    search: z.string().optional().describe("Search by name, provider, or description"),
    limit: z.number().optional().default(50).describe("Max results to return (default 50)"),
  },
  async ({ domain, category, search, limit }) => {
    if (!validateDomain(domain)) {
      return { content: [{ type: "text", text: `Domain "${domain}" not found. Use ubc_domains to list available domains.` }], isError: true };
    }

    if (search) {
      const results = searchResources(domain, search, category).slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    if (category) {
      const results = loadAllResources(domain)
        .filter((s) => s.category === category)
        .slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    const counts = getCategoryCounts(domain);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const summary = {
      domain,
      total_resources: total,
      categories: counts,
      detailed_guides: loadAllResources(domain).filter((s) => s.has_detailed_guide).map((s) => s.name),
      hint: "Use 'category' to browse a category, or 'search' to find specific resources.",
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "ubc_resource_guide",
  "Get the full setup guide for a resource — access steps, how to get credentials/tokens, free-tier limits.",
  {
    domain: z.string().default("compute").describe("Domain"),
    resource: z.string().describe("Resource name"),
  },
  async ({ domain, resource }) => {
    if (!validateDomain(domain)) {
      return { content: [{ type: "text", text: `Domain "${domain}" not found.` }], isError: true };
    }
    const res = loadResource(domain, resource);
    if (!res) {
      return { content: [{ type: "text", text: `Resource "${resource}" not found in domain "${domain}".` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

// ── Pattern Tools ──────────────────────────────────────

server.tool(
  "ubc_patterns",
  "List all assembly patterns for a domain. Patterns are known-good combinations of resources that produce outcomes.",
  {
    domain: z.string().default("compute").describe("Domain"),
  },
  async ({ domain }) => {
    if (!validateDomain(domain)) {
      return { content: [{ type: "text", text: `Domain "${domain}" not found.` }], isError: true };
    }
    const patterns = loadAllPatterns(domain);
    const summary = patterns.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      resources: (r.resources ?? []).map((s) => s.resource),
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "ubc_pattern_detail",
  "Get full details for a specific pattern including what it builds and estimated effort.",
  {
    domain: z.string().default("compute").describe("Domain"),
    pattern_id: z.string().describe("Pattern ID"),
  },
  async ({ domain, pattern_id }) => {
    if (!validateDomain(domain)) {
      return { content: [{ type: "text", text: `Domain "${domain}" not found.` }], isError: true };
    }
    const pattern = loadPattern(domain, pattern_id);
    if (!pattern) {
      return { content: [{ type: "text", text: `Pattern "${pattern_id}" not found in domain "${domain}".` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(pattern, null, 2) }] };
  }
);

// ── Status Tools ──────────────────────────────────────

server.tool(
  "ubc_status",
  "Check current setup state — which resources are provisioned, what access tokens exist, active pattern.",
  {
    domain: z.string().optional().describe("Filter by domain (omit for all domains)"),
  },
  async ({ domain }) => {
    const state = getState();
    if (domain) {
      const ds = state.domains[domain];
      if (!ds) {
        return { content: [{ type: "text", text: JSON.stringify({ domain, resources: {}, active_pattern: null }, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ domain, ...ds, project_status: state.project_status }, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  }
);

server.tool(
  "ubc_update_status",
  "Update the provisioning status of a resource.",
  {
    domain: z.string().default("compute").describe("Domain"),
    resource: z.string().describe("Resource name"),
    status: z.enum(["not_started", "in_progress", "ready", "failed"]),
  },
  async ({ domain, resource, status }) => {
    updateResourceStatus(domain, resource, status);
    return { content: [{ type: "text", text: `Updated ${resource} status to: ${status} (domain: ${domain})` }] };
  }
);

// ── Access Tools ──────────────────────────────────────

server.tool(
  "ubc_store_access",
  "Store an access token the user has provided (API key, enrollment ID, account credential, etc.).",
  {
    domain: z.string().default("compute").describe("Domain"),
    resource: z.string().describe("Resource name"),
    name: z.string().describe("Token name, e.g. GITHUB_TOKEN"),
    value: z.string().describe("The token value"),
    type: z.enum(["api_key", "api_token", "connection_string", "account_id", "enrollment", "certificate", "other"]).default("api_key"),
  },
  async ({ domain, resource, name, value, type }) => {
    storeAccess(domain, resource, name, value, type);
    updateResourceStatus(domain, resource, "ready");
    return { content: [{ type: "text", text: `Stored ${name} for ${resource} (domain: ${domain}).` }] };
  }
);

server.tool(
  "ubc_get_access",
  "Get all stored access tokens, optionally filtered by domain and resource. Values masked unless requested.",
  {
    domain: z.string().default("compute").describe("Domain"),
    resource: z.string().optional().describe("Filter by resource name"),
    reveal: z.boolean().default(false).describe("Show actual values (use with care)"),
  },
  async ({ domain, resource, reveal }) => {
    const tokens = getAccess(domain, resource);
    const result = tokens.map((c) => ({
      domain,
      resource: c.service,
      name: c.name,
      type: c.type,
      value: reveal
        ? c.value
        : c.value.length >= 16
          ? c.value.slice(0, 4) + "****" + c.value.slice(-4)
          : "****",
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Legacy Aliases (backward compatibility) ───────────

server.tool(
  "ubc_service_guide",
  "DEPRECATED: Use ubc_resource_guide. Get the full setup guide for a service.",
  { service: z.string().describe("Service name") },
  async ({ service }) => {
    const svc = loadResource("compute", service);
    if (!svc) {
      return { content: [{ type: "text", text: `Service "${service}" not found.` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(svc, null, 2) }] };
  }
);

server.tool(
  "ubc_recipes",
  "DEPRECATED: Use ubc_patterns. List all project recipes.",
  {},
  async () => {
    const patterns = loadAllPatterns("compute");
    const summary = patterns.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      services: (r.resources ?? r.services ?? []).map((s: { resource?: string; service?: string }) => s.resource ?? s.service),
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "ubc_recipe_detail",
  "DEPRECATED: Use ubc_pattern_detail. Get full details for a recipe.",
  { recipe_id: z.string().describe("Recipe ID") },
  async ({ recipe_id }) => {
    const pattern = loadPattern("compute", recipe_id);
    if (!pattern) {
      return { content: [{ type: "text", text: `Recipe "${recipe_id}" not found.` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(pattern, null, 2) }] };
  }
);

server.tool(
  "ubc_store_credential",
  "DEPRECATED: Use ubc_store_access. Store a credential.",
  {
    service: z.string(), name: z.string(), value: z.string(),
    type: z.enum(["api_key", "api_token", "connection_string", "account_id", "other"]).default("api_key"),
  },
  async ({ service, name, value, type }) => {
    storeAccess("compute", service, name, value, type);
    updateResourceStatus("compute", service, "ready");
    return { content: [{ type: "text", text: `Stored ${name} for ${service}.` }] };
  }
);

server.tool(
  "ubc_get_credentials",
  "DEPRECATED: Use ubc_get_access. Get stored credentials.",
  {
    service: z.string().optional(),
    reveal: z.boolean().default(false),
  },
  async ({ service, reveal }) => {
    const tokens = getAccess("compute", service);
    const result = tokens.map((c) => ({
      service: c.service,
      name: c.name,
      type: c.type,
      value: reveal
        ? c.value
        : c.value.length >= 16
          ? c.value.slice(0, 4) + "****" + c.value.slice(-4)
          : "****",
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Resources ──────────────────────────────────────────

server.resource(
  "ubc://domains",
  "ubc://domains",
  async () => {
    const domains = listDomains();
    return { contents: [{ uri: "ubc://domains", text: JSON.stringify(domains, null, 2), mimeType: "application/json" }] };
  }
);

server.resource(
  "ubc://status",
  "ubc://status",
  async () => {
    const state = getState();
    return { contents: [{ uri: "ubc://status", text: JSON.stringify(state, null, 2), mimeType: "application/json" }] };
  }
);

// ── Start ──────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
