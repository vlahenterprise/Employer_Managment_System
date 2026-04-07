import { cookies } from "next/headers";
import { exchangeGoogleWorkspaceCode } from "@/server/google-workspace";
import { getCurrentUser } from "@/server/current-user";
import { hasAdminAddon } from "@/server/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectUri(request: Request) {
  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/api/google/oauth/callback`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EMS Google Workspace</title><style>body{margin:0;background:#0d0d0f;color:#f5f5f5;font-family:Inter,Arial,sans-serif}.wrap{max-width:860px;margin:48px auto;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#151517;box-shadow:0 24px 80px rgba(0,0,0,.35)}h1{margin:0 0 12px;font-size:28px}.muted{color:#b8b8b8;line-height:1.6}.token{width:100%;min-height:120px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:#070708;color:#fff;padding:16px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;box-sizing:border-box}.pill{display:inline-flex;padding:6px 10px;border-radius:999px;background:#ff7a1a;color:#111;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.steps{line-height:1.9}.warn{border-left:4px solid #ff7a1a;padding:12px 14px;background:rgba(255,122,26,.08);border-radius:12px}</style></head><body><main class="wrap">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasAdminAddon(user)) return html("<h1>Nema pristupa</h1><p class=\"muted\">Samo admin korisnik može završiti Google Workspace povezivanje.</p>", 403);

  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = cookies().get("ems_google_oauth_state")?.value || "";
  cookies().delete("ems_google_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return html("<h1>OAuth nije uspeo</h1><p class=\"muted\">State provera nije prošla. Pokreni povezivanje ponovo iz admin sesije.</p>", 400);
  }

  const result = await exchangeGoogleWorkspaceCode({ code, redirectUri: redirectUri(request) });
  if (!result.ok) {
    return html(`<h1>OAuth nije uspeo</h1><p class="muted">Greška: ${escapeHtml(result.error)}</p>`, 400);
  }

  if (!result.refreshToken) {
    return html(
      `<span class="pill">Povezano</span><h1>Google nije vratio refresh token</h1><p class="muted">Ovo se obično desi ako je aplikacija već ranije autorizovana. Pokreni /api/google/oauth/start ponovo; ako se ponovi, ukloni pristup u Google Account permissions pa autorizuj ponovo.</p>`,
      200
    );
  }

  return html(`<span class="pill">Uspešno</span><h1>Google Workspace je autorizovan</h1><p class="muted">Kopiraj ovaj refresh token u Vercel env varijablu <b>GOOGLE_WORKSPACE_REFRESH_TOKEN</b>. Nemoj ga slati javno i nemoj ga commitovati u git.</p><textarea class="token" readonly>${escapeHtml(result.refreshToken)}</textarea><div class="warn"><b>Sledeće:</b> u Vercel Production env dodaj GOOGLE_WORKSPACE_REFRESH_TOKEN, zatim redeploy.</div><ol class="steps"><li>Vercel → Project → Settings → Environment Variables</li><li>Dodaj/izmeni <b>GOOGLE_WORKSPACE_REFRESH_TOKEN</b></li><li>Redeploy production</li></ol>`);
}
