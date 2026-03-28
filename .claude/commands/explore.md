Browse free-tier resources across all available domains.

1. Call `ubc_domains` to list all available domains
2. Present the domains in a friendly format — name, description, how many resources each has
3. If the user picks a domain, call `ubc_catalog` for that domain to show its resources:
   - Resource name and what it does
   - Free-tier limits (how much you get for free)
   - What it provides (hosting, database, AI, etc.)
4. If the user asks about a specific resource, call `ubc_resource_guide` to show the full details including signup steps and credential instructions
5. If the user describes a need that doesn't fit any domain, suggest creating a new one via the discovery agent
