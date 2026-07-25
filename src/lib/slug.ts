import { randomBytes } from "node:crypto";

export function slugify(statement: string): string {
  const base = statement
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const suffix = randomBytes(3).toString("hex");
  return `${base || "bet"}-${suffix}`;
}
