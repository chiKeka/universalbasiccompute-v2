/**
 * Provisioner Agent — signs up for a free-tier service using browser automation.
 * Loads a YAML template for guided signup flow, drives Playwright MCP.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getPlaywrightMcpConfig } from "../mcp/playwright-config.js";
import { createUbciMcpServer } from "../mcp/ubci-tools.js";
import { loadTemplate } from "../templates/loader.js";
import { streamAgentOutput } from "../lib/agent-stream.js";
import { safetyGuard } from "../hooks/safety-guard.js";
import { credentialCapture } from "../hooks/credential-capture.js";
import { progressReporter, resetProgress } from "../hooks/progress-reporter.js";

const PROVISIONER_SYSTEM_PROMPT = `You are the UBC Provisioner Agent. Your job is to sign up for a free-tier cloud service and capture API keys/credentials.

RULES:
- ONLY interact with free tier signup flows. NEVER click upgrade, billing, or payment buttons.
- If you encounter a CAPTCHA, stop and tell the user they need to solve it manually.
- If email verification is required, pause and ask the user to verify their email.
- Store every credential you capture using the ubci_store_credential tool.
- Follow the service template steps if one is provided.
- Be patient — pages may take time to load.

Use the Playwright MCP browser tools to:
1. Navigate to the signup page
2. Fill in registration forms
3. Handle OAuth flows if applicable
4. Navigate to the API key/token creation page
5. Create and capture API keys
6. Store credentials securely

After provisioning, report what was captured.`;

export interface ProvisionerOptions {
  model: string;
  headed: boolean;
}

export async function runProvisioner(
  serviceName: string,
  options: ProvisionerOptions
): Promise<void> {
  const template = loadTemplate(serviceName);
  const ubciMcp = createUbciMcpServer();

  let templateContext = "";
  if (template) {
    templateContext = `\n\nService template for ${serviceName}:\n\`\`\`yaml\n${JSON.stringify(template, null, 2)}\n\`\`\`\n\nFollow these steps to sign up and capture credentials.`;
  } else {
    templateContext = `\n\nNo template found for ${serviceName}. Use your best judgment to navigate the signup flow. Start at the service's website and look for a "Sign Up" or "Get Started" button.`;
  }

  const playwrightConfig = getPlaywrightMcpConfig(options.headed);

  const result = query({
    prompt: `Sign up for the free tier of ${serviceName} and capture all API keys/credentials.${templateContext}`,
    options: {
      systemPrompt: PROVISIONER_SYSTEM_PROMPT,
      model: options.model,
      maxTurns: 50,
      allowedTools: [
        "Read", "Bash", "WebFetch",
        "mcp__ubci__ubci_store_credential",
        "mcp__ubci__ubci_load_template",
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
          { matcher: "mcp__playwright.*", hooks: [credentialCapture] },
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
