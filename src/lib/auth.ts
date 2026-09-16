import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { db, schema } from "@/db";
import { magicLinkMail, sendEmail } from "@/lib/email";

const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

function assertAllowed(email: string) {
  if (allowed.length && !allowed.includes(email.toLowerCase())) {
    throw new Error("This email is not allowed to sign up.");
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // No passwords: a magic link proves the address, Google is the other door.
  emailAndPassword: { enabled: false },
  socialProviders: google,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          assertAllowed(u.email);
          // Magic-link sign-ups arrive without a name; derive one so the
          // UI never shows an empty author or owner.
          return { data: { ...u, name: u.name?.trim() || u.email.split("@")[0] } };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        assertAllowed(email);
        await sendEmail(magicLinkMail(email, url));
      },
    }),
    nextCookies(),
  ],
});

export const hasGoogle = Boolean(google);
export type Session = typeof auth.$Infer.Session;
