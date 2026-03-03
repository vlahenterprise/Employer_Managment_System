import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token, req }) => {
      if (!token) return false;
      const pathname = req.nextUrl.pathname;
      const status = (token as any).status as string | undefined;
      if (status && status !== "ACTIVE") return false;

      if (pathname.startsWith("/admin")) {
        const role = (token as any).role as string | undefined;
        return role === "ADMIN";
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
    "/performance/:path*"
  ]
};
