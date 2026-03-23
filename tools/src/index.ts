#!/usr/bin/env node
/**
 * UBC MCP Tools Server
 *
 * A standalone MCP server exposing UBC capabilities to any agent platform.
 * Run with: npx tsx tools/src/index.ts
 *
 * Tools: ubc_catalog, ubc_service_guide, ubc_status, ubc_store_credential,
 *        ubc_get_credentials, ubc_recipes, ubc_recipe_detail, ubc_update_status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadAllServices, loadService, searchServices, getCategoryCounts } from "./catalog.js";
import { loadAllRecipes, loadRecipe } from "./recipes.js";
import { getState, updateServiceStatus, type UBCState } from "./state.js";
import { storeCredential, getCredentials, getCredential } from "./credentials.js";

const server = new McpServer({
  name: "ubc-tools",
  version: "0.1.0",
});

// ── Tools ──────────────────────────────────────────────

server.tool(
  "ubc_catalog",
  "Browse the UBC free-tier service catalog (400+ services). Filter by category or search by name/description. Returns service name, category, description, free-tier limits, and whether a detailed setup guide exists.",
  {
    category: z.string().optional().describe("Filter by category: ai_llm, cloud_infrastructure, data_storage, automation_workflow, api_services, developer_tools"),
    search: z.string().optional().describe("Search by name, provider, or description"),
    limit: z.number().optional().default(50).describe("Max results to return (default 50)"),
  },
  async ({ category, search, limit }) => {
    if (search) {
      const results = searchServices(search, category).slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    if (category) {
      const results = loadAllServices()
        .filter((s) => s.category === category)
        .slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    // No filter: return summary with counts
    const counts = getCategoryCounts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const summary = {
      total_services: total,
      categories: counts,
      detailed_guides: loadAllServices().filter((s) => s.has_detailed_guide).map((s) => s.name),
      hint: "Use 'category' to browse a category, or 'search' to find specific services.",
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "ubc_service_guide",
  "Get the full setup guide for a service — signup steps, how to get credentials, free-tier limits.",
  { service: z.string().describe("Service name: github, vercel, supabase, openai, cloudflare") },
  async ({ service }) => {
    const svc = loadService(service);
    if (!svc) {
      return { content: [{ type: "text", text: `Service "${service}" not found.` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(svc, null, 2) }] };
  }
);

server.tool(
  "ubc_recipes",
  "List all available project recipes (pre-built project blueprints).",
  {},
  async () => {
    const recipes = loadAllRecipes();
    const summary = recipes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      services: r.services.map((s: { service: string; role: string }) => s.service),
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "ubc_recipe_detail",
  "Get full details for a specific recipe including what it builds and estimated usage.",
  { recipe_id: z.string().describe("Recipe ID: blog-ai, portfolio, saas-starter, ai-chatbot, api-backend") },
  async ({ recipe_id }) => {
    const recipe = loadRecipe(recipe_id);
    if (!recipe) {
      return { content: [{ type: "text", text: `Recipe "${recipe_id}" not found.` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(recipe, null, 2) }] };
  }
);

server.tool(
  "ubc_status",
  "Check current setup state — which services are provisioned, what credentials exist, active recipe.",
  {},
  async () => {
    const state = getState();
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  }
);

server.tool(
  "ubc_update_status",
  "Update the provisioning status of a service.",
  {
    service: z.string().describe("Service name"),
    status: z.enum(["not_started", "in_progress", "ready", "failed"]),
  },
  async ({ service, status }) => {
    updateServiceStatus(service, status);
    return { content: [{ type: "text", text: `Updated ${service} status to: ${status}` }] };
  }
);

server.tool(
  "ubc_store_credential",
  "Store a credential the user has provided (API key, token, URL, etc.).",
  {
    service: z.string().describe("Service name"),
    name: z.string().describe("Credential name, e.g. GITHUB_TOKEN"),
    value: z.string().describe("The credential value"),
    type: z.enum(["api_key", "api_token", "connection_string", "account_id", "other"]).default("api_key"),
  },
  async ({ service, name, value, type }) => {
    storeCredential(service, name, value, type);
    updateServiceStatus(service, "ready");
    return { content: [{ type: "text", text: `Stored ${name} for ${service}.` }] };
  }
);

server.tool(
  "ubc_get_credentials",
  "Get all stored credentials, optionally filtered by service. Returns credential names and types (values masked unless requested).",
  {
    service: z.string().optional().describe("Filter by service name"),
    reveal: z.boolean().default(false).describe("Show actual values (use with care)"),
  },
  async ({ service, reveal }) => {
    const creds = getCredentials(service);
    const result = creds.map((c) => ({
      service: c.service,
      name: c.name,
      type: c.type,
      value: reveal ? c.value : c.value.slice(0, 8) + "..." + c.value.slice(-4),
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Resources ──────────────────────────────────────────

server.resource(
  "ubc://catalog",
  "ubc://catalog",
  async () => {
    const services = loadAllServices();
    return { contents: [{ uri: "ubc://catalog", text: JSON.stringify(services, null, 2), mimeType: "application/json" }] };
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
