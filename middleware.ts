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

      // ADMIN can access anything
      // We can refine MANAGER permissions later based on the Permissions table
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
