Help the user set up UBC from scratch.

1. Call `ubc_domains` to see which domains are available
2. Call `ubc_status` to check current state (or note that nothing is set up yet)
3. Ask the user what they want to build (or let them browse domains)
4. For the chosen domain, call `ubc_patterns` to show available patterns
5. For the chosen pattern or custom goal, call `ubc_resource_guide` for each required resource and walk the user through:
   - Creating an account or enrolling (if they haven't already)
   - Getting the required credentials (API keys, tokens, etc.)
   - Store each credential using `ubc_store_access`
   - Track progress using `ubc_update_status`
6. Once all resources are accessible, let the user know they're ready to build

Be friendly and patient. Assume the user is not technical. Explain everything step by step.
