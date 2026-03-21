import { withAuth } from "next-auth/middleware";

export default withAuth({
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

      if (pathname.startsWith("/hr") || pathname.startsWith("/candidates") || pathname.startsWith("/talent-pool") || pathname.startsWith("/onboarding")) {
        return hrAddon || role === "HR";
      }

      return true;
    }
  }
});

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
    "/access/:path*"
  ]
};
