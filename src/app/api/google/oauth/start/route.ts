import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleWorkspaceAuthUrl } from "@/server/google-workspace";
import { getCurrentUser } from "@/server/current-user";
import { hasAdminAddon } from "@/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectUri(request: Request) {
  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/api/google/oauth/callback`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasAdminAddon(user)) return new Response("Forbidden", { status: 403 });

  const state = randomBytes(24).toString("hex");
  const authUrl = buildGoogleWorkspaceAuthUrl({ redirectUri: redirectUri(request), state });
  if (!authUrl) return new Response("Google Workspace OAuth is not configured", { status: 400 });

  cookies().set("ems_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/"
  });

  return NextResponse.redirect(authUrl);
}
