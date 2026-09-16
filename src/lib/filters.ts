/** Query evaluation for the `db` capability (top-level fields, in memory). */

export interface Filter {
  field: string;
  op: string;
  value: unknown;
}
export interface OrderBy {
  field: string;
  dir: "asc" | "desc";
}

const OPS = new Set(["==", "!=", "<", "<=", ">", ">=", "in", "not-in", "array-contains"]);

export function validateFilters(filters: Filter[]) {
  if (filters.length > 10) throw new Error("at most 10 filters");
  for (const f of filters) {
    if (typeof f.field !== "string" || !f.field) throw new Error("filter field must be a string");
    if (!OPS.has(f.op)) throw new Error(`unsupported operator ${f.op}`);
    if ((f.op === "in" || f.op === "not-in") && (!Array.isArray(f.value) || f.value.length > 30)) {
      throw new Error(`${f.op} needs an array of at most 30 values`);
    }
  }
}

function cmp(a: unknown, b: unknown): number | null {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return null;
}

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && a && b) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

export function matches(data: Record<string, unknown>, f: Filter): boolean {
  const v = data[f.field];
  switch (f.op) {
    case "==":
      return eq(v, f.value);
    case "!=":
      return !eq(v, f.value);
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const c = cmp(v, f.value);
      if (c === null) return false;
      return f.op === "<" ? c < 0 : f.op === "<=" ? c <= 0 : f.op === ">" ? c > 0 : c >= 0;
    }
    case "in":
      return (f.value as unknown[]).some((x) => eq(x, v));
    case "not-in":
      return !(f.value as unknown[]).some((x) => eq(x, v));
    case "array-contains":
      return Array.isArray(v) && v.some((x) => eq(x, f.value));
    default:
      return false;
  }
}

export function sortDocs<T extends { docId: string; data: Record<string, unknown> }>(
  rows: T[],
  order: OrderBy | null,
): T[] {
  if (!order) return rows.sort((a, b) => (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0));
  const dir = order.dir === "desc" ? -1 : 1;
  return rows.sort((a, b) => {
    const av = a.data[order.field];
    const bv = b.data[order.field];
    const aMissing = av === undefined;
    const bMissing = bv === undefined;
    if (aMissing && bMissing) return a.docId < b.docId ? -1 : 1;
    if (aMissing) return 1;
    if (bMissing) return -1;
    const c = cmp(av, bv);
    if (c === null || c === 0) return a.docId < b.docId ? -1 : 1;
    return c * dir;
  });
}
