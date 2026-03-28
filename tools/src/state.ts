/**
 * State management — tracks what's provisioned in .ubc/state.json
 * Domain-aware: state is nested under domains.{domain}.resources
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UBC_DIR = join(__dirname, "..", "..", ".ubc");
const STATE_FILE = join(UBC_DIR, "state.json");

export interface ResourceState {
  status: "not_started" | "in_progress" | "ready" | "failed";
  access: string[];
  provisioned_at?: string;
}

export interface DomainState {
  resources: Record<string, ResourceState>;
  active_pattern: string | null;
}

export interface UBCState {
  domains: Record<string, DomainState>;
  project_status: "idle" | "planning" | "provisioning" | "assembling" | "ready" | "failed";
  created_at: string;
  updated_at: string;
}

function defaultState(): UBCState {
  return {
    domains: {},
    project_status: "idle",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function ensureDomain(state: UBCState, domain: string): DomainState {
  if (!state.domains[domain]) {
    state.domains[domain] = { resources: {}, active_pattern: null };
  }
  return state.domains[domain];
}

/** Migrate old flat state format to new domain-nested format. */
function migrateState(raw: Record<string, unknown>): UBCState {
  // Old format: { services: {...}, active_recipe: ..., project_status: ... }
  if ("services" in raw && !("domains" in raw)) {
    const oldServices = raw.services as Record<string, { status: string; credentials: string[]; provisioned_at?: string }>;
    const resources: Record<string, ResourceState> = {};
    for (const [name, svc] of Object.entries(oldServices)) {
      resources[name] = {
        status: svc.status as ResourceState["status"],
        access: svc.credentials ?? [],
        provisioned_at: svc.provisioned_at,
      };
    }
    return {
      domains: {
        compute: {
          resources,
          active_pattern: (raw.active_recipe as string) ?? null,
        },
      },
      project_status: (raw.project_status as UBCState["project_status"]) ?? "idle",
      created_at: (raw.created_at as string) ?? new Date().toISOString(),
      updated_at: (raw.updated_at as string) ?? new Date().toISOString(),
    };
  }
  return raw as unknown as UBCState;
}

export function getState(): UBCState {
  if (!existsSync(STATE_FILE)) {
    return defaultState();
  }
  const raw = readFileSync(STATE_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  return migrateState(parsed);
}

function saveState(state: UBCState): void {
  if (!existsSync(UBC_DIR)) {
    mkdirSync(UBC_DIR, { recursive: true, mode: 0o700 });
  }
  state.updated_at = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { encoding: "utf-8", mode: 0o600 });
  chmodSync(STATE_FILE, 0o600);
}

export function updateResourceStatus(
  domain: string,
  resource: string,
  status: ResourceState["status"]
): void {
  const state = getState();
  const ds = ensureDomain(state, domain);
  if (!ds.resources[resource]) {
    ds.resources[resource] = { status: "not_started", access: [] };
  }
  ds.resources[resource].status = status;
  if (status === "ready") {
    ds.resources[resource].provisioned_at = new Date().toISOString();
  }
  saveState(state);
}

export function addAccessToState(domain: string, resource: string, tokenName: string): void {
  const state = getState();
  const ds = ensureDomain(state, domain);
  if (!ds.resources[resource]) {
    ds.resources[resource] = { status: "not_started", access: [] };
  }
  if (!ds.resources[resource].access.includes(tokenName)) {
    ds.resources[resource].access.push(tokenName);
  }
  saveState(state);
}

export function setActivePattern(domain: string, patternId: string | null): void {
  const state = getState();
  const ds = ensureDomain(state, domain);
  ds.active_pattern = patternId;
  saveState(state);
}

export function setProjectStatus(status: UBCState["project_status"]): void {
  const state = getState();
  state.project_status = status;
  saveState(state);
}
