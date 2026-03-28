/**
 * Access storage — stores access tokens/credentials locally in .ubc/access/{domain}/
 *
 * Generalized from credentials.ts to handle any access type:
 * API keys, enrollment IDs, account bookmarks, certificates, etc.
 *
 * Encrypted with AES-256-GCM using a machine-local key.
 * The key is generated on first use and stored in .ubc/.key (mode 0600).
 * Access files are stored with mode 0600 (owner-only read/write).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { addAccessToState } from "./state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UBC_DIR = join(__dirname, "..", "..", ".ubc");
const KEY_FILE = join(UBC_DIR, ".key");
const LEGACY_CREDS_DIR = join(UBC_DIR, "credentials");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "ubc-credential-store";

export interface StoredAccess {
  service: string;
  name: string;
  value: string;
  type: string;
  stored_at: string;
}

interface EncryptedAccess {
  service: string;
  name: string;
  encrypted: string;
  type: string;
  stored_at: string;
}

function accessDir(domain: string): string {
  return join(UBC_DIR, "access", domain);
}

function ensureDir(domain: string): void {
  if (!existsSync(UBC_DIR)) {
    mkdirSync(UBC_DIR, { recursive: true, mode: 0o700 });
  }
  const dir = accessDir(domain);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function getEncryptionKey(): Buffer {
  if (!existsSync(UBC_DIR)) {
    mkdirSync(UBC_DIR, { recursive: true, mode: 0o700 });
  }
  if (existsSync(KEY_FILE)) {
    const raw = readFileSync(KEY_FILE, "utf-8").trim();
    return scryptSync(raw, SALT, KEY_LENGTH);
  }
  const secret = randomBytes(32).toString("hex");
  writeFileSync(KEY_FILE, secret, { encoding: "utf-8", mode: 0o600 });
  chmodSync(KEY_FILE, 0o600);
  return scryptSync(secret, SALT, KEY_LENGTH);
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(packed: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf-8");
}

function readAccessFile(filepath: string): StoredAccess {
  const raw = readFileSync(filepath, "utf-8");
  const parsed = JSON.parse(raw);

  if ("value" in parsed && !("encrypted" in parsed)) {
    const cred: StoredAccess = parsed as StoredAccess;
    writeEncryptedAccess(filepath, cred);
    return cred;
  }

  const enc = parsed as EncryptedAccess;
  return {
    service: enc.service,
    name: enc.name,
    value: decrypt(enc.encrypted),
    type: enc.type,
    stored_at: enc.stored_at,
  };
}

function writeEncryptedAccess(filepath: string, access: StoredAccess): void {
  const enc: EncryptedAccess = {
    service: access.service,
    name: access.name,
    encrypted: encrypt(access.value),
    type: access.type,
    stored_at: access.stored_at,
  };
  writeFileSync(filepath, JSON.stringify(enc, null, 2), { encoding: "utf-8", mode: 0o600 });
  chmodSync(filepath, 0o600);
}

export function storeAccess(
  domain: string,
  resource: string,
  name: string,
  value: string,
  type: string
): void {
  ensureDir(domain);
  const access: StoredAccess = {
    service: resource,
    name,
    value,
    type,
    stored_at: new Date().toISOString(),
  };
  const filename = `${resource.toLowerCase()}_${name.toLowerCase()}.json`;
  writeEncryptedAccess(join(accessDir(domain), filename), access);
  addAccessToState(domain, resource, name);
}

function readFromDir(dir: string): StoredAccess[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const results: StoredAccess[] = [];
  for (const f of files) {
    try {
      results.push(readAccessFile(join(dir, f)));
    } catch {
      continue;
    }
  }
  return results;
}

export function getAccess(domain: string, resource?: string): StoredAccess[] {
  ensureDir(domain);
  let creds = readFromDir(accessDir(domain));

  // Fallback: check legacy credentials/ dir for compute domain
  if (domain === "compute" && creds.length === 0 && existsSync(LEGACY_CREDS_DIR)) {
    creds = readFromDir(LEGACY_CREDS_DIR);
  }

  if (resource) {
    return creds.filter((c) => c.service.toLowerCase() === resource.toLowerCase());
  }
  return creds;
}

export function getAccessItem(domain: string, resource: string, name: string): StoredAccess | null {
  const creds = getAccess(domain, resource);
  return creds.find((c) => c.name === name) ?? null;
}
