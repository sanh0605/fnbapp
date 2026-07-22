import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token) {
      const role = token.role as string;
      
      // STAFF only allowed in POS
      if (role === "STAFF" && path.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/pos", req.url));
      }

      // ADMIN and MANAGER can access anything (owner decision 2026-07-22:
      // granular per-role permissions deferred to the later security-
      // hardening phase; only STAFF is restricted for now)
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    secret: process.env.NEXTAUTH_SECRET,
  }
);

export const config = {
  matcher: ["/pos/:path*", "/admin/:path*"],
};
