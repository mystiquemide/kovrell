import type { Metadata } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["500", "600"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });

const DESCRIPTION =
  "A voice agent that calls the vendor back on the number of record before a changed bank account gets paid. Built on the AssemblyAI Voice Agent API.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || "https://kovrell.midelabs.xyz"),
  title: { default: "Kovrell: voice verification before you pay", template: "%s | Kovrell" },
  description: DESCRIPTION,
  openGraph: {
    title: "Kovrell calls the vendor before you pay",
    description: DESCRIPTION,
    url: "/",
    siteName: "Kovrell",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Kovrell: a voice agent verifying a vendor bank-detail change" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Kovrell calls the vendor before you pay", description: DESCRIPTION, images: ["/og.jpg"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
