import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { findAll } from "@/lib/sheets_db";
import bcrypt from "bcryptjs";

export type AuthActor = {
  id: string;
  name: string;
  role: "ADMIN" | "STAFF" | "SYSTEM";
};

export type AuthResult =
  | { ok: true; actor: AuthActor }
  | { ok: false; error: string };

/**
 * Resolve current actor from session. CLI_MODE bypasses auth for scripts.
 * Returns typed actor with role for downstream authz.
 *
 * Claude code — CODE-22: centralize auth check so server actions can guard.
 */
export async function resolveActor(): Promise<AuthResult> {
  if (process.env.CLI_MODE === "true") {
    return { ok: true, actor: { id: "system", name: "Hệ thống", role: "SYSTEM" } };
  }
  // Lazy import to avoid pulling next-auth into CLI scripts.
  const { getServerSession } = await import("next-auth/next");
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Yêu cầu đăng nhập" };
  }
  const role = (session.user as any).role as AuthActor["role"] | undefined;
  if (!role) {
    return { ok: false, error: "Phiên đăng nhập không có role" };
  }
  return {
    ok: true,
    actor: {
      id: (session.user as any).id || "unknown",
      name: session.user.name || "Unknown",
      role,
    },
  };
}

/**
 * Require ADMIN role. Returns actor on success or error message on failure.
 * Server actions should call this at the top and short-circuit on `ok: false`.
 *
 * Claude code — CODE-22.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await resolveActor();
  if (!result.ok) return result;
  if (result.actor.role !== "ADMIN" && result.actor.role !== "SYSTEM") {
    return { ok: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" };
  }
  return result;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Tên đăng nhập", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Fetch all users from Google Sheets
          const users = await findAll("Users");
          const user = users.find((u) => u.username === credentials.username);

          if (!user) {
            console.log("User not found");
            return null;
          }

          // In case the password isn't hashed yet in the Sheet (for quick test), we do a fallback comparison
          const isMatch = await bcrypt.compare(credentials.password, user.password_hash);
          
          if (isMatch || credentials.password === user.password_hash) {
            return {
              id: user.id,
              name: user.username,
              role: user.role
            };
          }

          return null;
        } catch (error) {
          console.error("Auth Error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
