import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ConditionalCursor } from "@/components/ui/conditional-cursor";
import { GradientBackground } from "@/components/ui/gradient-background";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Julow — AI-native workspace",
  description:
    "A thoughtful, agent-powered workspace. Canvas boards, remote automation, and adaptive tools built for modern teams.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <I18nProvider>
            <TRPCProvider>
              <GradientBackground />
              <ConditionalCursor />
              {children}
            </TRPCProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
