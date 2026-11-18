import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gavin Whitlock, Solution Engineer",
  description:
    "Austin-based solution engineer with 10+ years in enterprise SaaS. Ask my AI assistant, built with LangChain.js and the open-weight Kimi K3 model.",
  openGraph: {
    title: "Gavin Whitlock, Solution Engineer",
    description: "Ask my AI assistant about my experience and fit for your role.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={schibsted.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
