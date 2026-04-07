import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";
import { config } from "./config";
import { prisma } from "./db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAllowedEmail(email: string) {
  const allowedDomains = config.auth.allowedEmailDomains;
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return allowedDomains.includes(domain);
}

function isGoogleEnabled() {
  return Boolean(config.auth.googleClientId && config.auth.googleClientSecret);
}

const baseAdapter = PrismaAdapter(prisma);

const adapter: NextAuthOptions["adapter"] = {
  ...baseAdapter,
  async createUser(data: Omit<AdapterUser, "id">) {
    const email = data.email ? normalizeEmail(data.email) : "";
    if (!email) {
      throw new Error("User email is required");
    }

    if (!isAllowedEmail(email)) {
      throw new Error("Email domain is not allowed");
    }

    if (!config.auth.autoProvision) {
      throw new Error("Auto-provisioning is disabled");
    }

    const name = data.name?.trim() || email.split("@")[0];

    return prisma.user.create({
      data: {
        ...data,
        email,
        name
      }
    });
  }
};

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const authOptions: NextAuthOptions = {
  adapter,
  secret: config.auth.secret,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: 60 * 60 },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = normalizeEmail(parsed.data.email);
        if (!isAllowedEmail(email)) return null;

        // Rate limiting: max 10 pokušaja po email-u u 10 minuta
        const { Ratelimit } = await import("@upstash/ratelimit").catch(() => ({ Ratelimit: null }));
        const { Redis } = await import("@upstash/redis").catch(() => ({ Redis: null }));

        if (Ratelimit && Redis) {
          const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
          const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
          if (redisUrl && redisToken) {
            try {
              const ratelimit = new Ratelimit({
                redis: new Redis({ url: redisUrl, token: redisToken }),
                limiter: Ratelimit.slidingWindow(10, "10 m"),
                analytics: false
              });
              const { success } = await ratelimit.limit(`login:${email}`);
              if (!success) return null;
            } catch {
              // Nastavi bez rate limita ako Redis nije dostupan
            }
          }
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            hrAddon: true,
            adminAddon: true,
            companyCalendarAddon: true,
            status: true,
            teamId: true,
            passwordHash: true
          }
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hrAddon: user.hrAddon,
          adminAddon: user.adminAddon,
          companyCalendarAddon: user.companyCalendarAddon,
          status: user.status,
          teamId: user.teamId
        } as any;
      }
    }),
    ...(isGoogleEnabled()
      ? [
          GoogleProvider({
            clientId: config.auth.googleClientId!,
            clientSecret: config.auth.googleClientSecret!
          })
        ]
      : [])
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email ? normalizeEmail(user.email) : "";
      if (!email) return false;
      if (!isAllowedEmail(email)) return false;

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { status: true }
      });
      if (!dbUser) return config.auth.autoProvision;
      return dbUser.status === "ACTIVE";
    },
    async jwt({ token, user }) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(Number((token as any).iat))) {
        (token as any).iat = nowSeconds;
      }
      if (user) {
        (token as any).role = (user as any).role;
        (token as any).hrAddon = (user as any).hrAddon ?? false;
        (token as any).adminAddon = (user as any).adminAddon ?? false;
        (token as any).companyCalendarAddon = (user as any).companyCalendarAddon ?? false;
        (token as any).status = (user as any).status;
        (token as any).teamId = (user as any).teamId ?? null;
        (token as any).iat = nowSeconds;
      }
      return token;
    },
    async session({ session, token }) {
      const issuedAt = Number((token as any).iat);
      if (Number.isFinite(issuedAt) && Math.floor(Date.now() / 1000) - issuedAt > SESSION_MAX_AGE_SECONDS) {
        session.expires = new Date(0).toISOString();
        return session;
      }
      if (session.user) {
        (session.user as any).id = token.sub ?? (session.user as any).id;
        (session.user as any).role = (token as any).role ?? "USER";
        (session.user as any).hrAddon = (token as any).hrAddon ?? false;
        (session.user as any).adminAddon = (token as any).adminAddon ?? false;
        (session.user as any).companyCalendarAddon = (token as any).companyCalendarAddon ?? false;
        (session.user as any).status = (token as any).status ?? "ACTIVE";
        (session.user as any).teamId = (token as any).teamId ?? null;
      }
      return session;
    }
  }
};
