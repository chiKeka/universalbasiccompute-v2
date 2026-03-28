# Universal Basic Compute — Agent Toolkit (v0.3.0)

You are helping a user with the **UBC Agent Toolkit** — a domain-agnostic protocol that organizes free-tier resources into domains and helps users combine them into working projects.

## What This Repo Is

This repo contains **pre-built agents** that:
1. **Plan** which free-tier resources to combine for a project within a domain
2. **Guide** users through gaining access (enrollment, API keys, accounts, etc.)
3. **Assemble** provisioned resources into deployed projects
4. **Discover** new resources and create new domains
5. **Set up** agent infrastructure (OpenClaw, etc.) on the user's behalf

## How To Help The User

When a user opens this repo and asks for help:

1. **Check state first**: Read `.ubc/state.json` (if it exists) to see what's already configured
2. **If new user**: Walk them through setup — explain what UBC is, show them the available domains and patterns, guide them through access setup
3. **If returning user**: Pick up where they left off based on state

## Available Agents (in `/agents/`)

| Agent | Purpose | When to use |
|-------|---------|-------------|
| **master** | Orchestrates everything | Default — delegates to others |
| **planner** | Selects resources for a goal within a domain | When user describes a project |
| **guide** | Walks through resource access/enrollment | When setting up a resource |
| **assembler** | Builds and deploys projects | After all resources are accessible |
| **discovery** | Finds new resources, creates new domains | When checking for new resources or no domain fits |
| **infra** | Sets up agent infrastructure | When user wants OpenClaw/etc |

## Domains (in `/domains/`)

Resources are organized into domains. Each domain has:
- `domain.yaml` — metadata, resource types, access types
- `resources/` — individual resource definitions (YAML)
- `patterns/` — proven combinations of resources (YAML)

For example, `domains/compute/resources/` contains cloud service definitions and `domains/compute/patterns/` contains project blueprints like blog-ai, saas-starter, etc.

Use `ubc_domains` to list available domains. Use `ubc_catalog` to browse resources within a domain.

## Protocol (in `/protocol/`)

YAML schemas that define the structure of domain.yaml, resource definitions, and pattern definitions. All new content must follow these schemas.

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

**Tools available**: `ubc_domains`, `ubc_catalog`, `ubc_resource_guide`, `ubc_patterns`, `ubc_create_domain`, `ubc_status`, `ubc_update_status`, `ubc_store_access`, `ubc_get_access`

## State Tracking

- `.ubc/state.json` — What resources are set up, active pattern, project status
- `.ubc/access/{domain}/` — Stored access credentials per domain (gitignored)

## Guiding A Non-Technical User

Assume the user is **not technical**. When helping them:
- Use plain, simple language
- Explain what each resource does and why they need it
- Give step-by-step browser instructions ("Click the blue button that says...")
- Celebrate small wins ("Your GitHub account is ready!")
- Never show raw JSON/code unless they ask
- If they're confused, offer to explain or try a different approach
