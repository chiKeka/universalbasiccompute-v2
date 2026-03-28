/**
 * Legacy in-memory catalog for the CLI.
 * The canonical catalog is in /domains/compute/resources/ (resource definitions)
 * loaded by /tools/src/catalog.ts.
 * This file exists for backward compatibility with CLI commands.
 */

export interface CatalogEntry {
  name: string;
  provider: string;
  category: string;
  pricing_url: string;
  description: string;
  free_tier: Array<{ limit: string; value: number; unit: string; notes?: string }>;
}

export const CATALOG: CatalogEntry[] = [
  {
    name: "GitHub",
    provider: "GitHub",
    category: "cloud_infrastructure",
    pricing_url: "https://github.com/pricing",
    description: "Code hosting, CI/CD with Actions, Packages, Codespaces",
    free_tier: [
      { limit: "Actions Minutes", value: 2000, unit: "min/mo", notes: "Public repos; 500 for private" },
      { limit: "Packages Storage", value: 500, unit: "MB" },
      { limit: "Codespaces", value: 120, unit: "core-hrs/mo" },
    ],
  },
  {
    name: "Vercel",
    provider: "Vercel",
    category: "cloud_infrastructure",
    pricing_url: "https://vercel.com/pricing",
    description: "Frontend hosting, serverless functions, edge network",
    free_tier: [
      { limit: "Bandwidth", value: 100, unit: "GB/mo" },
      { limit: "Serverless", value: 100, unit: "GB-hrs/mo" },
      { limit: "Build Minutes", value: 6000, unit: "min/mo" },
    ],
  },
  {
    name: "Supabase",
    provider: "Supabase",
    category: "cloud_infrastructure",
    pricing_url: "https://supabase.com/pricing",
    description: "Postgres database, Auth, Edge Functions, Realtime, Storage",
    free_tier: [
      { limit: "Database", value: 500, unit: "MB" },
      { limit: "Storage", value: 1, unit: "GB" },
      { limit: "Edge Functions", value: 500000, unit: "inv/mo" },
      { limit: "Auth MAUs", value: 50000, unit: "/mo" },
    ],
  },
  {
    name: "OpenAI API",
    provider: "OpenAI",
    category: "ai_llm",
    pricing_url: "https://openai.com/api/pricing/",
    description: "GPT models, embeddings, DALL-E, Whisper, TTS",
    free_tier: [
      { limit: "Free Credits", value: 5, unit: "USD", notes: "One-time trial" },
      { limit: "Rate Limit", value: 500, unit: "req/min" },
    ],
  },
  {
    name: "Cloudflare",
    provider: "Cloudflare",
    category: "cloud_infrastructure",
    pricing_url: "https://www.cloudflare.com/plans/",
    description: "CDN, Workers, Pages, R2 storage, D1 database, KV",
    free_tier: [
      { limit: "Workers", value: 100000, unit: "req/day" },
      { limit: "Pages Builds", value: 500, unit: "/mo" },
      { limit: "R2 Storage", value: 10, unit: "GB/mo" },
      { limit: "D1 Database", value: 5, unit: "GB" },
    ],
  },
];

export function getCatalog(category?: string): CatalogEntry[] {
  if (!category) return CATALOG;
  return CATALOG.filter((s) => s.category === category);
}

export function findService(name: string): CatalogEntry | undefined {
  return CATALOG.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() ||
           s.provider.toLowerCase() === name.toLowerCase()
  );
}
