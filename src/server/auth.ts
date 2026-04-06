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

export const authOptions: NextAuthOptions = {
  adapter,
  secret: config.auth.secret,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
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

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            hrAddon: true,
            adminAddon: true,
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
      if (user) {
        (token as any).role = (user as any).role;
        (token as any).hrAddon = (user as any).hrAddon ?? false;
        (token as any).adminAddon = (user as any).adminAddon ?? false;
        (token as any).status = (user as any).status;
        (token as any).teamId = (user as any).teamId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub ?? (session.user as any).id;
        (session.user as any).role = (token as any).role ?? "USER";
        (session.user as any).hrAddon = (token as any).hrAddon ?? false;
        (session.user as any).adminAddon = (token as any).adminAddon ?? false;
        (session.user as any).status = (token as any).status ?? "ACTIVE";
        (session.user as any).teamId = (token as any).teamId ?? null;
      }
      return session;
    }
  }
};
