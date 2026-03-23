# Universal Basic Compute

A DIY agent toolkit that provisions and assembles free-tier cloud services into working projects.

Clone this repo. Open it in any AI coding tool. The agents do the rest.

## What's Inside

**6 Autonomous Agents** that work together:

| Agent | What it does |
|-------|-------------|
| Master | Orchestrates everything — your entry point |
| Planner | Picks the right free services for your project |
| Provisioner | Walks you through creating accounts step by step |
| Assembler | Builds and deploys your project |
| Catalog | Keeps the free-tier service list up to date |
| Infra | Helps set up agent infrastructure (OpenClaw, etc.) |

**10 Free-Tier Services** ready to provision:
- GitHub (code hosting, CI/CD)
- Vercel (hosting, serverless)
- Supabase (database, auth)
- OpenAI (AI/GPT)
- Cloudflare (CDN, workers, storage)
- Netlify (hosting, forms, edge)
- Render (web services, Postgres)
- Neon (serverless Postgres)
- Resend (email API)
- Upstash (serverless Redis)

**5 Project Recipes** you can build today:
- Blog with AI summarization
- Portfolio site
- SaaS starter
- AI chatbot
- REST API backend

## Quick Start

### With Claude Code
```bash
git clone https://github.com/chiKeka/universalbasiccompute-v2.git
cd universalbasiccompute-v2
npm install
```
Then open in Claude Code and type:
```
/setup
```
The agent walks you through everything.

### With Any MCP-Compatible Agent (OpenClaw, Cursor, etc.)

Add this to your MCP config:
```json
{
  "mcpServers": {
    "ubc": {
      "command": "npx",
      "args": ["tsx", "tools/src/index.ts"],
      "cwd": "/path/to/universalbasiccompute-v2"
    }
  }
}
```

Your agent now has access to the full UBC toolkit.

### With Docker
```bash
git clone https://github.com/chiKeka/universalbasiccompute-v2.git
cd universalbasiccompute-v2
ANTHROPIC_API_KEY=sk-ant-... docker compose up
```

### Manual
```bash
git clone https://github.com/chiKeka/universalbasiccompute-v2.git
cd universalbasiccompute-v2
pnpm install
pnpm ubc catalog list          # Browse free services
pnpm ubc plan "build a blog"   # Plan which services to use
```

## How It Works

1. You tell the agent what you want to build
2. The **planner** picks the right free-tier services
3. The **provisioner** walks you through creating accounts (step by step, in plain English)
4. You paste your API keys back — they're stored locally and securely
5. The **assembler** wires everything together and deploys
6. You get a working project on free infrastructure

## Project Structure

```
agents/       — Agent definitions (the brains)
services/     — Free-tier service catalog (signup guides, limits, credentials)
recipes/      — Pre-built project blueprints
tools/        — MCP server (universal toolkit any agent can use)
.claude/      — Claude Code integration (commands, context)
.ubc/         — Your local state and credentials (gitignored)
```

## Extending

**Add a service**: Create a new YAML in `services/` following the existing format.

**Add a recipe**: Create a new YAML in `recipes/` listing required services and what to build.

**Add an agent**: Create a new directory in `agents/` with an `agent.yaml` and `README.md`.

**Connect to your agent platform**: Point your MCP config at `tools/src/index.ts`.

## The Idea

Free-tier services from GitHub, Vercel, Supabase, OpenAI, Cloudflare, and dozens more collectively provide meaningful compute power — enough to build real applications without paying for infrastructure. We call this **Universal Basic Compute**.

This toolkit makes that compute accessible to everyone, not just developers.

## License

MIT
