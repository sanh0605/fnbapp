if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}

import type { Metadata } from "next";
import "./globals.css";
import NextAuthSessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "FNB App v2 - Google Sheets",
  description: "FNB App powered by Next.js and Google Sheets",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FNB App",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
