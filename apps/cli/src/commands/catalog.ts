import { Command } from "commander";
import { getApiKey } from "../lib/config.js";

export const catalogCommand = new Command("catalog")
  .description("Manage the UBCI service catalog");

catalogCommand
  .command("list")
  .description("List all services in the catalog")
  .option("-c, --category <cat>", "Filter by category")
  .action(async (opts) => {
    const { getCatalog } = await import("../mcp/catalog-data.js");
    const catalog = getCatalog(opts.category);
    console.log("\nUBCI Service Catalog");
    console.log("=" .repeat(70));
    for (let i = 0; i < catalog.length; i++) {
      const s = catalog[i];
      const limits = s.free_tier
        .map((l: { limit: string; value: number; unit: string }) => `${l.limit}: ${l.value} ${l.unit}`)
        .join(", ");
      const pad = s.name.padEnd(14);
      console.log(`  ${i + 1}. ${pad} [${s.category}]`);
      console.log(`     ${s.description}`);
      console.log(`     Free: ${limits}`);
      console.log();
    }
    console.log(`${catalog.length} services tracked.`);
  });

catalogCommand
  .command("update")
  .description("Refresh service catalog by scraping pricing pages")
  .option("-s, --service <name>", "Update a specific service only")
  .option("-m, --model <model>", "Model to use", "claude-sonnet-4-6-20250514")
  .action(async (opts) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("No Anthropic API key. Run: ubc config set anthropic_api_key <key>");
      process.exit(1);
    }

    const target = opts.service ?? "all";
    console.log(`\nUpdating catalog: ${target}\n`);
    const { runCatalogUpdater } = await import("../agents/catalog-updater.js");
    await runCatalogUpdater({ service: opts.service, model: opts.model });
  });

catalogCommand
  .command("discover")
  .description("Search for new free-tier services not yet in the catalog")
  .action(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("No Anthropic API key. Run: ubc config set anthropic_api_key <key>");
      process.exit(1);
    }
    console.log("\nDiscovering new free-tier services...");
    const { runCatalogUpdater } = await import("../agents/catalog-updater.js");
    await runCatalogUpdater({ discover: true });
  });

catalogCommand
  .command("validate")
  .description("Test all signup templates against live sites")
  .action(async () => {
    console.log("Validating signup templates... (Phase 4)");
  });

catalogCommand
  .command("diff")
  .description("Show changes since last catalog update")
  .action(async () => {
    console.log("Catalog changes (Phase 2 — query change_log table)");
  });
