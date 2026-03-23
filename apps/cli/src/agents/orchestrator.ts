/**
 * Orchestrator Agent — top-level coordinator.
 * Chains: Plan → Provision (per service) → Assemble
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { getPlaywrightMcpConfig } from "../mcp/playwright-config.js";
import { createUbciMcpServer } from "../mcp/ubci-tools.js";
import { streamAgentOutput } from "../lib/agent-stream.js";
import { safetyGuard } from "../hooks/safety-guard.js";
import { credentialCapture } from "../hooks/credential-capture.js";
import { progressReporter, resetProgress } from "../hooks/progress-reporter.js";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the UBC Orchestrator Agent. Your job is to help users build projects using only free-tier cloud services.

When the user describes a project goal:
1. First, use the "planner" subagent to analyze the goal and select the best combination of free-tier services
2. Then, for each selected service, use the "provisioner" subagent to create accounts and capture credentials
3. Finally, use the "assembler" subagent to connect the services and scaffold the project

Always explain what you're doing at each step. Be transparent about limitations of free tiers.

Available services in the UBCI catalog:
- GitHub: Code hosting, CI/CD (2000 Actions min/mo), Codespaces (120 core-hrs/mo)
- Vercel: Frontend hosting, serverless (100 GB-hrs/mo), 6000 build min/mo
- Supabase: Postgres (500MB), Auth (50k MAU), Edge Functions (500k/mo), Storage (1GB)
- OpenAI API: $5 free credits, GPT-3.5-turbo access
- Cloudflare: Workers (100k req/day), Pages, R2 (10GB), D1 (5GB)

Use the ubci_query_catalog MCP tool to get detailed service information.`;

export interface OrchestratorOptions {
  model: string;
  maxBudgetUsd: number;
  dryRun: boolean;
}

export async function createOrchestrator(
  goal: string,
  options: OrchestratorOptions
): Promise<void> {
  const ubciMcp = createUbciMcpServer();

  const queryOptions: Options = {
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    model: options.model,
    maxTurns: options.dryRun ? 20 : 100,
    allowedTools: [
      "Read", "Write", "Edit", "Bash", "Glob", "Grep",
      "WebSearch", "WebFetch", "Agent",
      "mcp__ubci__ubci_query_catalog",
      "mcp__ubci__ubci_store_credential",
      "mcp__ubci__ubci_emit_progress",
    ],
    mcpServers: {
      ubci: ubciMcp,
      playwright: getPlaywrightMcpConfig(),
    },
    agents: {
      planner: {
        description: "Analyzes user goals and selects optimal free-tier services from the UBCI catalog",
        prompt: "You are the UBC Planner. Given a project goal, query the service catalog and recommend 3-5 free-tier services that can achieve the goal. Output a structured plan with services, roles, and estimated usage.",
        tools: ["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
        model: "sonnet",
        maxTurns: 15,
      },
      provisioner: {
        description: "Signs up for a free-tier service using browser automation, captures API keys and credentials",
        prompt: "You are the UBC Provisioner. Use Playwright MCP browser tools to navigate service signup pages, create accounts, and capture API keys/credentials. Follow the service template if provided. Store credentials using ubci_store_credential.",
        tools: ["Read", "Bash", "WebFetch"],
        model: "sonnet",
        maxTurns: 50,
      },
      assembler: {
        description: "Connects provisioned services together, generates project scaffolding, and deploys",
        prompt: "You are the UBC Assembler. Given provisioned services and their credentials, wire everything together: create project scaffolding, .env files, and deploy. Use CLI tools (vercel, supabase, etc.) for deployment.",
        tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        model: "sonnet",
        maxTurns: 100,
      },
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
  };

  resetProgress();

  const prompt = options.dryRun
    ? `Plan (but do NOT provision or deploy) how to build: ${goal}`
    : `Build this project using free-tier services: ${goal}`;

  console.log("Starting orchestrator...\n");
  const result = query({ prompt, options: queryOptions });
  await streamAgentOutput(result);
  console.log("\nOrchestrator complete.");
}
