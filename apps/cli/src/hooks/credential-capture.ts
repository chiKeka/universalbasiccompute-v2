/**
 * Credential Capture Hook (PostToolUse)
 *
 * Scans Playwright MCP tool results for patterns that look like
 * API keys, tokens, or connection strings. When detected, logs
 * them for the agent to store via ubci_store_credential.
 */

import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

/** Patterns for common credential formats */
const CREDENTIAL_PATTERNS: Array<{ name: string; pattern: RegExp; type: string }> = [
  // OpenAI
  { name: "OPENAI_API_KEY", pattern: /sk-[a-zA-Z0-9_-]{20,}/, type: "api_key" },
  // Supabase
  { name: "SUPABASE_KEY", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, type: "api_key" },
  // Supabase/Postgres connection strings
  { name: "DATABASE_URL", pattern: /postgresql:\/\/[^\s"']+/, type: "connection_string" },
  // Cloudflare
  { name: "CLOUDFLARE_TOKEN", pattern: /[a-zA-Z0-9_-]{40}/, type: "api_key" },
  // GitHub tokens
  { name: "GITHUB_TOKEN", pattern: /ghp_[a-zA-Z0-9]{36}/, type: "api_key" },
  { name: "GITHUB_TOKEN", pattern: /github_pat_[a-zA-Z0-9_]{22,}/, type: "api_key" },
  // Vercel
  { name: "VERCEL_TOKEN", pattern: /[a-zA-Z0-9]{24}/, type: "api_key" },
  // Generic Bearer tokens
  { name: "BEARER_TOKEN", pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/, type: "oauth_token" },
  // Generic long hex tokens (at least 32 chars)
  { name: "API_TOKEN", pattern: /[a-f0-9]{32,}/, type: "api_key" },
];

/** Minimum length to avoid false positives on short strings */
const MIN_CREDENTIAL_LENGTH = 20;

export const credentialCapture: HookCallback = async (input, _toolUseID, _options) => {
  const toolName = input.tool_name ?? "";

  // Only scan Playwright tool results
  if (!toolName.includes("playwright")) {
    return { decision: "allow" as const };
  }

  const resultText = JSON.stringify(input.tool_result ?? "");

  const detected: Array<{ name: string; value: string; type: string }> = [];

  for (const { name, pattern, type } of CREDENTIAL_PATTERNS) {
    const match = resultText.match(pattern);
    if (match && match[0].length >= MIN_CREDENTIAL_LENGTH) {
      // Avoid duplicates
      if (!detected.some((d) => d.value === match[0])) {
        detected.push({ name, value: match[0], type });
      }
    }
  }

  if (detected.length > 0) {
    const summary = detected
      .map((d) => `  ${d.name}: ${d.value.slice(0, 12)}...${d.value.slice(-4)} (${d.type})`)
      .join("\n");
    console.log(`\n  [CREDENTIAL DETECTED]\n${summary}`);
    console.log(`  Hint: Agent should store these with ubci_store_credential\n`);
  }

  return { decision: "allow" as const };
};
