import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function parseBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

const hrModuleEnabled = parseBool(process.env.ENABLE_HR_MODULE, true);

function isHrPath(pathname: string) {
  return (
    pathname.startsWith("/hr") ||
    pathname.startsWith("/candidates") ||
    pathname.startsWith("/talent-pool") ||
    pathname.startsWith("/onboarding")
  );
}

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
    if (!hrModuleEnabled && (isHrPath(pathname) || pathname.startsWith("/management"))) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token) return false;
        const pathname = req.nextUrl.pathname;
        const status = (token as any).status as string | undefined;
        const role = (token as any).role as string | undefined;
        const hrAddon = Boolean((token as any).hrAddon);
        const adminAddon = Boolean((token as any).adminAddon);
        if (status && status !== "ACTIVE") return false;

        if (pathname.startsWith("/admin")) {
          return adminAddon || role === "ADMIN";
        }

        if (pathname.startsWith("/access")) {
          return adminAddon || role === "ADMIN";
        }

        if (pathname.startsWith("/management")) {
          if (!hrModuleEnabled) return true;
          return role === "MANAGER" || role === "ADMIN";
        }

        if (isHrPath(pathname)) {
          if (!hrModuleEnabled) return true;
          return hrAddon || role === "HR";
        }

        return true;
      }
    }
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/reports/:path*",
    "/tasks/:path*",
    "/absence/:path*",
    "/performance/:path*",
    "/organization/:path*",
    "/hr/:path*",
    "/management/:path*",
    "/team/:path*",
    "/profile/:path*",
    "/inbox/:path*",
    "/candidates/:path*",
    "/talent-pool/:path*",
    "/onboarding/:path*",
    "/access/:path*",
    "/company-calendar/:path*"
  ]
};
