import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Project TANAW — TNHS SMEA Consolidator",
    template: "%s — Project TANAW",
  },
  description:
    "Project TANAW is the West 1 District MEA platform that consolidates governed school MEA packets for TNHS.",
  applicationName: "Project TANAW",
  authors: [{ name: "Project TANAW" }],
  creator: "Project TANAW",
  keywords: [
    "Project TANAW",
    "TNHS",
    "SMEA",
    "MEA",
    "DepEd",
    "West 1 District",
    "school data",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b3a8c" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
