/**
 * Safety Guard Hook (PreToolUse)
 *
 * Blocks the agent from:
 * - Navigating to payment/billing/upgrade pages
 * - Clicking on pricing upgrade buttons
 * - Entering credit card information
 * - Running destructive bash commands
 */

import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

/** URL patterns that indicate payment/billing pages */
const BLOCKED_URL_PATTERNS = [
  /billing/i,
  /payment/i,
  /upgrade/i,
  /checkout/i,
  /subscribe/i,
  /pricing.*pro/i,
  /pricing.*enterprise/i,
  /pricing.*team/i,
  /buy/i,
  /purchase/i,
  /credit.?card/i,
  /stripe\.com/i,
  /paypal\.com/i,
];

/** Selector patterns that indicate upgrade/payment actions */
const BLOCKED_SELECTOR_PATTERNS = [
  /upgrade/i,
  /buy.*now/i,
  /subscribe/i,
  /add.*payment/i,
  /enter.*card/i,
  /credit.?card/i,
  /billing.*info/i,
  /pro.*plan/i,
  /team.*plan/i,
  /enterprise/i,
];

/** Dangerous bash patterns */
const BLOCKED_BASH_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,      // rm -rf / or ~
  /mkfs/,                    // format disk
  /dd\s+if=/,               // raw disk write
  /:\(\)\s*\{/,             // fork bomb
  /shutdown/i,
  /reboot/i,
];

export const safetyGuard: HookCallback = async (input, _toolUseID, _options) => {
  const toolName = input.tool_name ?? "";
  const toolInput = input.tool_input as Record<string, unknown> ?? {};

  // Check Playwright navigation
  if (toolName.includes("playwright") && toolName.includes("navigate")) {
    const url = String(toolInput["url"] ?? "");
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(url)) {
        return {
          decision: "block" as const,
          reason: `Blocked navigation to payment/billing URL: ${url}. UBC only uses free tiers.`,
        };
      }
    }
  }

  // Check Playwright clicks
  if (toolName.includes("playwright") && toolName.includes("click")) {
    const selector = String(toolInput["selector"] ?? toolInput["element"] ?? "");
    for (const pattern of BLOCKED_SELECTOR_PATTERNS) {
      if (pattern.test(selector)) {
        return {
          decision: "block" as const,
          reason: `Blocked click on upgrade/payment element: "${selector}". UBC only uses free tiers.`,
        };
      }
    }
  }

  // Check Playwright fill for credit card fields
  if (toolName.includes("playwright") && toolName.includes("fill")) {
    const selector = String(toolInput["selector"] ?? toolInput["element"] ?? "");
    if (/card|cvv|cvc|expir|billing/i.test(selector)) {
      return {
        decision: "block" as const,
        reason: `Blocked form fill on payment field: "${selector}". UBC does not enter payment information.`,
      };
    }
  }

  // Check bash commands
  if (toolName === "Bash") {
    const command = String(toolInput["command"] ?? "");
    for (const pattern of BLOCKED_BASH_PATTERNS) {
      if (pattern.test(command)) {
        return {
          decision: "block" as const,
          reason: `Blocked dangerous command: "${command}".`,
        };
      }
    }
  }

  // Allow everything else
  return { decision: "allow" as const };
};
