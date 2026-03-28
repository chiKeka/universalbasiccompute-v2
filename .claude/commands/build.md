Assemble and deploy the user's project using their provisioned resources.

1. Call `ubc_status` to check what's set up and which domain is active
2. Read the active pattern from the domain's patterns/ directory
3. Check that all required resources have status "ready"
4. If anything is missing, tell the user and offer to help set it up
5. If everything is ready:
   - Call `ubc_get_access` with reveal:true to retrieve credentials for each resource
   - Create a new project directory
   - Scaffold the project based on the pattern
   - Create .env file with all credentials
   - Install dependencies
   - Deploy to the target platform (Vercel, Cloudflare, etc.)
6. Report the result — show the deployed URL
