import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  customType,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ---------- better-auth tables (shape per better-auth 1.5 core schema) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ---------- application tables ---------- */

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export type Role = "view" | "interact" | "edit";
export type LinkAccess = "none" | Role;

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    favicon: text("favicon"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Declared runtime capabilities: `{db: {...}, room: {...}, ...}`. */
    capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default({}),
    linkAccess: text("link_access").$type<LinkAccess>().notNull().default("none"),
    currentVersionId: text("current_version_id"),
    versionCount: integer("version_count").notNull().default(0),
    docCount: integer("doc_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("artifacts_owner_idx").on(t.ownerId, t.updatedAt)],
);

export const versions = pgTable(
  "versions",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    label: text("label"),
    html: text("html").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("versions_artifact_number_idx").on(t.artifactId, t.number)],
);

/** Supporting files published alongside the page (per artifact, latest wins). */
export const files = pgTable(
  "files",
  {
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    data: bytea("data").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.artifactId, t.path] })],
);

export const shares = pgTable(
  "shares",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<Role>().notNull(),
    invitedBy: text("invited_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shares_artifact_email_idx").on(t.artifactId, t.email),
    index("shares_email_idx").on(t.email),
  ],
);

/** The `db` capability: JSON documents at slash-separated paths. */
export const docs = pgTable(
  "docs",
  {
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    collection: text("collection").notNull(),
    docId: text("doc_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    leaseHolder: text("lease_holder"),
    leaseExpiresAt: timestamp("lease_expires_at"),
  },
  (t) => [
    primaryKey({ columns: [t.artifactId, t.path] }),
    index("docs_collection_idx").on(t.artifactId, t.collection),
  ],
);

/** The `room` capability: presence heartbeats and transient events. */
export const presence = pgTable(
  "presence",
  {
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    peer: text("peer").notNull(),
    uid: text("uid"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.artifactId, t.peer] }), index("presence_seen_idx").on(t.lastSeen)],
);

export const roomEvents = pgTable(
  "room_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    data: jsonb("data"),
    peer: text("peer").notNull(),
    uid: text("uid"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("room_events_time_idx").on(t.createdAt)],
);

/** The `assets` capability: uploaded blobs served at `/_blob/<id>`. */
export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: bytea("data").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("assets_artifact_idx").on(t.artifactId, t.createdAt)],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_artifact_idx").on(t.artifactId, t.createdAt)],
);

/** Personal API tokens for the Claude Code skill. Hash only. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export type Artifact = typeof artifacts.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Doc = typeof docs.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type User = typeof user.$inferSelect;
