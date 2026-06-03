import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { findAll } from "@/lib/sheets_db";
import bcrypt from "bcryptjs";

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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
