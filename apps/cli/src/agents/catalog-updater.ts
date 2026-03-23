/**
 * Catalog Agent — discovers and updates the UBCI service catalog.
 * Replaces v1's Firecrawl+Gemini pipeline with agent-driven scraping.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getPlaywrightMcpConfig } from "../mcp/playwright-config.js";
import { createUbciMcpServer } from "../mcp/ubci-tools.js";
import { streamAgentOutput } from "../lib/agent-stream.js";
import { safetyGuard } from "../hooks/safety-guard.js";
import { progressReporter, resetProgress } from "../hooks/progress-reporter.js";

const CATALOG_UPDATER_SYSTEM_PROMPT = `You are the UBC Catalog Agent. Your job is to keep the UBCI service catalog up-to-date by scraping pricing pages and discovering new free-tier services.

For UPDATES:
1. Use ubci_query_catalog to get the list of tracked services and their pricing URLs
2. For each service, use Playwright to visit the pricing page
3. Extract the current free-tier limits (quotas, features, units, periods)
4. Compare with stored values and report any changes
5. Update the catalog via ubci_update_catalog if changes are detected

For DISCOVERY:
1. Search the web for "new free tier cloud API", "free developer tools 2026", etc.
2. Check curated lists like free-for.dev
3. For each new service found, extract free-tier details
4. Add to catalog via ubci_add_service

Always be accurate. If you can't determine a limit precisely, flag it for human review.
Do NOT include paid-only services or services where the free tier has been discontinued.`;

export interface CatalogUpdaterOptions {
  service?: string;
  model?: string;
  discover?: boolean;
}

export async function runCatalogUpdater(
  options: CatalogUpdaterOptions
): Promise<void> {
  const ubciMcp = createUbciMcpServer();
  const playwrightConfig = getPlaywrightMcpConfig();

  let prompt: string;
  if (options.discover) {
    prompt = "Search the web for new free-tier cloud/AI services that are not yet in the UBCI catalog. For each one found, extract the free-tier limits and add it to the catalog.";
  } else if (options.service) {
    prompt = `Update the catalog entry for "${options.service}". Visit its pricing page, extract current free-tier limits, and compare with stored values. Report and apply any changes.`;
  } else {
    prompt = "Run a full catalog update. For each tracked service, visit the pricing page, extract current free-tier limits, compare with stored values, and report changes.";
  }

  const result = query({
    prompt,
    options: {
      systemPrompt: CATALOG_UPDATER_SYSTEM_PROMPT,
      model: options.model ?? "claude-sonnet-4-6-20250514",
      maxTurns: 50,
      allowedTools: [
        "Read", "WebSearch", "WebFetch",
        "mcp__ubci__ubci_query_catalog",
        "mcp__ubci__ubci_get_service_limits",
        "mcp__ubci__ubci_emit_progress",
        "mcp__playwright__*",
      ],
      mcpServers: {
        ubci: ubciMcp,
        playwright: playwrightConfig,
      },
      hooks: {
        PreToolUse: [
          { matcher: "Bash|mcp__playwright.*", hooks: [safetyGuard] },
        ],
        PostToolUse: [
          { matcher: ".*", hooks: [progressReporter] },
        ],
      },
      permissionMode: "acceptEdits",
    },
  });

  resetProgress();
  await streamAgentOutput(result);
  console.log();
}
