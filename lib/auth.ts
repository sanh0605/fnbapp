import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseClient } from "@/lib/supabase";

export type AuthActor = {
  id: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "SYSTEM";
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
 * Require ADMIN or MANAGER role -- full admin-panel access, including
 * personnel management. Only STAFF is restricted (POS-only). Granular
 * per-role permissions are deliberately deferred to the later security-
 * hardening roadmap phase; for now Manager and Admin are equivalent.
 *
 * Claude code — CODE-22. Widened to include MANAGER 2026-07-22 (owner
 * decision).
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await resolveActor();
  if (!result.ok) return result;
  if (result.actor.role !== "ADMIN" && result.actor.role !== "MANAGER" && result.actor.role !== "SYSTEM") {
    return { ok: false, error: "Chỉ Admin hoặc Manager mới có quyền thực hiện thao tác này" };
  }
  return result;
}

/**
 * Require ADMIN (the owner today -- see below) or internal SYSTEM. Stricter
 * than requireAdmin(), which also accepts MANAGER.
 *
 * Plan D D14, owner decision 2026-08-09: undoing a confirmed stocktake count
 * is the first action in the system that needs a guard tighter than
 * requireAdmin() -- a stocktake checks the person counting, and if the
 * person being checked (MANAGER, the same role staff-facing counting
 * screens run under) can erase the check, it stops being one. A dedicated
 * function rather than editing requireAdmin(), which stays correct for
 * every other call site.
 *
 * ADMIN is not a distinct "owner" role today, only accidentally equivalent to
 * it -- checked live 2026-08-09, exactly one ADMIN account exists. SYSTEM is
 * kept for CLI scripts under CLAUDE.md section 2's own dry-run/--apply/
 * owner-approval protocol, the same allowance requireAdmin() already makes.
 */
export async function requireOwner(): Promise<AuthResult> {
  const result = await resolveActor();
  if (!result.ok) return result;
  if (result.actor.role !== "ADMIN" && result.actor.role !== "SYSTEM") {
    return { ok: false, error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" };
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
          // Claude code — Supabase migration Phase D: lookup user from Supabase.
          const supabase = getSupabaseClient();
          const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password_hash, name, role, status")
            .eq("username", credentials.username)
            .maybeSingle();

          if (error) {
            console.error("Auth Supabase error:", error.message);
            return null;
          }
          if (!user) {
            console.log("User not found:", credentials.username);
            return null;
          }
          if (user.status !== "ACTIVE") {
            console.log("User inactive:", credentials.username);
            return null;
          }

          // bcrypt-only. Removed plaintext fallback (security hardening).
          const isMatch = await bcrypt.compare(credentials.password, user.password_hash);
          if (!isMatch) {
            return null;
          }

          return {
            id: user.id,
            name: user.username,
            role: user.role,
          };
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
