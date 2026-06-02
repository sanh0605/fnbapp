import type { Metadata } from "next";
import "./globals.css";
import NextAuthSessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "FNB App v2 - Google Sheets",
  description: "FNB App powered by Next.js and Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
