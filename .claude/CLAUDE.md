# Universal Basic Compute — Agent Toolkit

You are helping a user with the **UBC Agent Toolkit** — a collection of autonomous agents that provision and assemble free-tier cloud services into working projects.

## What This Repo Is

This repo contains **pre-built agents** that:
1. **Plan** which free-tier services to combine for a project
2. **Guide** users through creating accounts and getting API keys
3. **Assemble** provisioned services into deployed projects
4. **Maintain** the catalog of available free-tier services
5. **Set up** agent infrastructure (OpenClaw, etc.) on the user's behalf

## How To Help The User

When a user opens this repo and asks for help:

1. **Check state first**: Read `.ubc/state.json` (if it exists) to see what's already configured
2. **If new user**: Walk them through setup — explain what UBC is, show them the recipes, guide them through provisioning
3. **If returning user**: Pick up where they left off based on state

## Available Agents (in `/agents/`)

| Agent | Purpose | When to use |
|-------|---------|-------------|
| **master** | Orchestrates everything | Default — delegates to others |
| **planner** | Selects services for a goal | When user describes a project |
| **provisioner** | Guides through account signup | When setting up a service |
| **assembler** | Builds and deploys projects | After all services provisioned |
| **catalog** | Updates service catalog | When checking for new services |
| **infra** | Sets up agent infrastructure | When user wants OpenClaw/etc |

## Available Services (in `/services/`)

Each YAML file has: signup steps, credential instructions, free-tier limits.
- **GitHub** — Code hosting, CI/CD (2000 Actions min/mo)
- **Vercel** — Hosting, serverless (100GB bandwidth/mo)
- **Supabase** — Postgres, Auth, Edge Functions (500MB DB)
- **OpenAI** — GPT, embeddings ($5 free credits)
- **Cloudflare** — Workers, Pages, R2 (100k req/day)
- **Netlify** — Hosting, forms, edge (100GB bandwidth/mo)
- **Render** — Web services, Postgres (750 hrs/mo)
- **Neon** — Serverless Postgres (512MB, branching)
- **Resend** — Email API (3000 emails/mo)
- **Upstash** — Serverless Redis (10k commands/day)

## Available Recipes (in `/recipes/`)

Pre-built project blueprints:
- `blog-ai` — Blog with AI summarization
- `portfolio` — Personal portfolio site
- `saas-starter` — SaaS template with auth
- `ai-chatbot` — GPT-powered chatbot
- `api-backend` — REST API on Cloudflare Workers

## MCP Tools Server (in `/tools/`)

A standalone MCP server exposing all UBC capabilities. Connect from any agent platform:

```json
{
  "mcpServers": {
    "ubc": {
      "command": "node",
      "args": ["--import", "tsx/esm", "tools/src/index.ts"],
      "cwd": "<path-to-this-repo>"
    }
  }
}
```

**Tools available**: `ubc_catalog`, `ubc_service_guide`, `ubc_recipes`, `ubc_recipe_detail`, `ubc_status`, `ubc_update_status`, `ubc_store_credential`, `ubc_get_credentials`

## State Tracking

- `.ubc/state.json` — What services are provisioned, active recipe, project status
- `.ubc/credentials/` — Stored API keys and tokens (gitignored)

## Guiding A Non-Technical User

Assume the user is **not technical**. When helping them:
- Use plain, simple language
- Explain what each service does and why they need it
- Give step-by-step browser instructions ("Click the blue button that says...")
- Celebrate small wins ("Your GitHub account is ready!")
- Never show raw JSON/code unless they ask
- If they're confused, offer to explain or try a different approach
