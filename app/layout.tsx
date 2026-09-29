if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}

import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import NextAuthSessionProvider from "@/components/providers/SessionProvider";
import { DialogHost } from "@/components/providers/DialogHost";
import { DevPreviewToolsLoader } from "@/components/dev-feedback/DevPreviewToolsLoader";

const appFont = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app",
});

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
    <html lang="vi" className={appFont.variable}>
      <body>
        <NextAuthSessionProvider>
          {children}
          <DialogHost />
          {process.env.NODE_ENV !== "production" && <DevPreviewToolsLoader />}
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
