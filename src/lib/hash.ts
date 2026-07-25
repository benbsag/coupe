import { createHash } from "node:crypto";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHashFor(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
