type CookieJar = Map<string, string>;

function extractSetCookieHeaders(response: Response) {
  const withGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export function updateCookieJar(jar: CookieJar, response: Response) {
  const setCookies = extractSetCookieHeaders(response);
  for (const row of setCookies) {
    const [pair] = String(row).split(";");
    const [name, ...rest] = pair.split("=");
    const key = name?.trim();
    if (!key) continue;
    jar.set(key, rest.join("=").trim());
  }
}

export function getCookieHeader(jar: CookieJar) {
  return [...jar.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export async function loginWithCredentials(params: {
  baseUrl: string;
  email: string;
  password: string;
}) {
  const jar: CookieJar = new Map();

  const csrfRes = await fetch(`${params.baseUrl}/api/auth/csrf`, {
    headers: { Accept: "application/json" }
  });
  updateCookieJar(jar, csrfRes);
  if (!csrfRes.ok) {
    throw new Error(`Unable to fetch CSRF token (${csrfRes.status})`);
  }

  const csrfData = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = String(csrfData.csrfToken || "").trim();
  if (!csrfToken) {
    throw new Error("CSRF token missing from NextAuth response");
  }

  const body = new URLSearchParams({
    email: params.email,
    password: params.password,
    csrfToken,
    callbackUrl: `${params.baseUrl}/dashboard`,
    json: "true"
  });

  const loginRes = await fetch(`${params.baseUrl}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: getCookieHeader(jar)
    },
    body,
    redirect: "manual"
  });
  updateCookieJar(jar, loginRes);
  if (![200, 302].includes(loginRes.status)) {
    throw new Error(`Credentials login failed (${loginRes.status})`);
  }

  const sessionRes = await fetch(`${params.baseUrl}/api/auth/session`, {
    headers: {
      Accept: "application/json",
      Cookie: getCookieHeader(jar)
    }
  });
  updateCookieJar(jar, sessionRes);
  if (!sessionRes.ok) {
    throw new Error(`Unable to verify session (${sessionRes.status})`);
  }

  const session = (await sessionRes.json()) as { user?: { email?: string } };
  if (String(session.user?.email || "").trim().toLowerCase() !== params.email.trim().toLowerCase()) {
    throw new Error("Authenticated session email does not match requested credentials");
  }

  return {
    jar,
    cookieHeader: getCookieHeader(jar)
  };
}
