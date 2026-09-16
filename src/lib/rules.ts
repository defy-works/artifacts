/**
 * Access rules for the `db` capability. A viewer has a level; every path
 * has a minimum level for read and write, taken from the most specific
 * declared rule. `{self}` as the last segment names each viewer's own
 * subtree, invisible to everyone else.
 */
import type { LinkAccess, Role } from "@/db/schema";

export type Level = "none" | "view" | "interact" | "edit" | "owner";
export const LEVEL_RANK: Record<Level, number> = {
  none: 0,
  view: 1,
  interact: 2,
  edit: 3,
  owner: 4,
};

type RuleLevel = "view" | "interact" | "admin" | "owner";
const RULE_RANK: Record<RuleLevel, number> = { view: 1, interact: 2, admin: 3, owner: 4 };

export interface DbRule {
  path: string;
  read?: RuleLevel;
  write?: RuleLevel;
}

export function maxRole(...levels: Array<Level | LinkAccess | Role | null | undefined>): Level {
  let best: Level = "none";
  for (const l of levels) {
    if (!l) continue;
    if (LEVEL_RANK[l as Level] > LEVEL_RANK[best]) best = l as Level;
  }
  return best;
}

export function atLeast(level: Level, min: Level): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[min];
}

export function parseRules(capabilities: Record<string, unknown> | null | undefined): DbRule[] {
  const dbCap = capabilities?.db;
  if (!dbCap || typeof dbCap !== "object") return [];
  const rules = (dbCap as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((r) => r && typeof r === "object" && typeof (r as DbRule).path === "string")
    .slice(0, 64) as DbRule[];
}

const DEFAULT_RULES: DbRule[] = [
  { path: "", read: "view", write: "interact" },
  { path: "data/users/{self}", write: "interact" },
];

interface Resolved {
  readRank: number;
  writeRank: number;
  /** true when the path lies inside another viewer's private subtree */
  hidden: boolean;
}

/**
 * Resolve the minimum read/write rank for `path` given the rules and the
 * viewer's uid. Rules apply to their path and everything below; a deeper
 * rule overrides; unset levels inherit from the nearest rule above.
 */
export function resolvePath(
  rules: DbRule[],
  path: string,
  uid: string | null,
): Resolved {
  const all = [...DEFAULT_RULES, ...rules];
  const segs = path === "" ? [] : path.split("/");
  let readRank = RULE_RANK.view;
  let writeRank = RULE_RANK.interact;
  let hidden = false;
  let bestDepth = -1;
  // Track inherited levels in depth order: sort rules by depth ascending so
  // deeper rules apply last.
  const sorted = all
    .map((r) => ({ r, segs: r.path === "" ? [] : r.path.split("/") }))
    .sort((a, b) => a.segs.length - b.segs.length);
  for (const { r, segs: rs } of sorted) {
    if (rs.length > segs.length) continue;
    let match = true;
    let selfMatch = true;
    for (let i = 0; i < rs.length; i++) {
      if (rs[i] === "{self}" && i === rs.length - 1) {
        if (!uid || segs[i] !== uid) selfMatch = false;
        continue;
      }
      if (rs[i] !== segs[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    if (!selfMatch) {
      // Path is inside a {self} subtree that isn't ours. Unless a rule AT
      // the prefix opened it (both read+write set), it is invisible.
      const prefixPath = rs.slice(0, -1).join("/");
      const opener = all.find((o) => o.path === prefixPath && o.read && o.write && o !== r);
      if (!opener) {
        hidden = true;
      }
      continue;
    }
    if (rs.length >= bestDepth) bestDepth = rs.length;
    if (r.read) readRank = RULE_RANK[r.read];
    if (r.write) writeRank = RULE_RANK[r.write];
  }
  if (writeRank < readRank) writeRank = readRank;
  return { readRank, writeRank, hidden };
}

export function canRead(rules: DbRule[], path: string, uid: string | null, level: Level) {
  const r = resolvePath(rules, path, uid);
  if (r.hidden) return false;
  return LEVEL_RANK[level] >= r.readRank;
}

export function canWrite(rules: DbRule[], path: string, uid: string | null, level: Level) {
  const r = resolvePath(rules, path, uid);
  if (r.hidden) return false;
  return LEVEL_RANK[level] >= r.writeRank;
}

/** Room topic levels: admin-only unless opened to `interact`. */
export function topicMinRank(capabilities: Record<string, unknown> | null | undefined, topic: string): number {
  const room = capabilities?.room;
  if (room && typeof room === "object") {
    const topics = (room as { topics?: Record<string, string> }).topics;
    const lvl = topics?.[topic];
    if (lvl === "interact") return LEVEL_RANK.interact;
    if (lvl === "view") return LEVEL_RANK.view;
  }
  return LEVEL_RANK.edit;
}
