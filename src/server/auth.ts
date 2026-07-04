import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

const DAY = 60 * 60 * 24;

export const auth = betterAuth({
  appName: "Julow",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Allow the Expo app (custom scheme) to complete auth flows.
  trustedOrigins: ["julow://", "julow://*"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: DAY * 30,
    updateAge: DAY,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  // Organization == Julow workspace. Roles: owner / admin / member.
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
      invitationExpiresIn: DAY * 7,
    }),
    expo(),
    // Must stay last so cookies are written from server actions / route handlers.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
