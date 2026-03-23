/**
 * Progress Reporter Hook (PostToolUse)
 *
 * Emits structured progress events after each tool call.
 * Phase 1: Console output with formatting.
 * Phase 2: Will write to Supabase agent_events table for Realtime.
 */

import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

/** Map tool names to human-readable descriptions */
function describeToolCall(toolName: string, toolInput: Record<string, unknown>): string | null {
  // Playwright navigation
  if (toolName.includes("navigate")) {
    return `Navigating to ${toolInput["url"] ?? "page"}`;
  }
  if (toolName.includes("click")) {
    return `Clicking: ${toolInput["selector"] ?? toolInput["element"] ?? "element"}`;
  }
  if (toolName.includes("fill")) {
    const selector = String(toolInput["selector"] ?? toolInput["element"] ?? "field");
    // Don't log password values
    if (/password/i.test(selector)) {
      return `Filling: ${selector} (value hidden)`;
    }
    return `Filling: ${selector}`;
  }
  if (toolName.includes("snapshot") || toolName.includes("screenshot")) {
    return "Reading page content";
  }

  // UBCI tools
  if (toolName.includes("ubci_store_credential")) {
    return `Storing credential: ${toolInput["credential_name"]}`;
  }
  if (toolName.includes("ubci_query_catalog")) {
    return "Querying service catalog";
  }
  if (toolName.includes("ubci_load_template")) {
    return `Loading template: ${toolInput["service_name"]}`;
  }

  // Standard tools
  if (toolName === "WebSearch") {
    return `Searching: ${toolInput["query"]}`;
  }
  if (toolName === "WebFetch") {
    return `Fetching: ${toolInput["url"]}`;
  }
  if (toolName === "Bash") {
    const cmd = String(toolInput["command"] ?? "");
    return `Running: ${cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd}`;
  }

  // Skip noisy tools
  if (toolName === "Read" || toolName === "Glob" || toolName === "Grep") {
    return null;
  }

  return null;
}

let stepCount = 0;

export const progressReporter: HookCallback = async (input, _toolUseID, _options) => {
  const toolName = input.tool_name ?? "";
  const toolInput = input.tool_input as Record<string, unknown> ?? {};

  const description = describeToolCall(toolName, toolInput);
  if (description) {
    stepCount++;
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`  [${timestamp}] Step ${stepCount}: ${description}`);
  }

  // TODO Phase 2: Write to Supabase agent_events table
  // const { getSupabaseClient } = await import("../lib/supabase.js");
  // const client = getSupabaseClient();
  // await client.from("agent_events").insert({
  //   run_id: currentRunId,
  //   project_id: currentProjectId,
  //   event_type: "step_completed",
  //   service_name: currentServiceName,
  //   message: description,
  //   metadata: { tool: toolName, step: stepCount },
  // });

  return { decision: "allow" as const };
};

/** Reset step counter for a new run */
export function resetProgress(): void {
  stepCount = 0;
}
