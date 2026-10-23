import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { GlobalSearch } from "./components/global-search";
import { Nav } from "./components/nav";
import { PortalDisclosure, PortalSection } from "./components/portal-links";
import { SidebarCards } from "./components/sidebar-cards";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "job-radar",
  description: "Entry-level developer roles in India, matched against my resume",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <div className="min-h-dvh md:grid md:grid-cols-[4.5rem_1fr] lg:grid-cols-[20rem_1fr]">
          <aside className="sticky top-0 z-30 flex items-center gap-2 sidebar-dark px-3 py-2 sm:gap-3 sm:px-4 shadow-lift md:h-dvh md:flex-col md:items-stretch md:gap-7 md:px-3 md:py-7 lg:px-5">
            {/* Wordmark: big block letters. The icon rail only has room for "JR". */}
            <Link href="/" aria-label="job-radar home" className="shrink-0 font-black uppercase leading-none tracking-tighter md:text-center lg:px-1 lg:text-left focus-visible:outline-2 focus-visible:outline-spark">
              <span aria-hidden="true" className="text-base min-[360px]:text-lg sm:text-xl md:hidden lg:inline lg:text-[2rem]">
                Job<span className="text-spark">Radar</span>
              </span>
              <span aria-hidden="true" className="hidden text-2xl md:inline lg:hidden">
                J<span className="text-spark">R</span>
              </span>
            </Link>
            <Nav />
            <PortalDisclosure />
            {/* Desktop: cards and portals scroll together under the fixed logo + nav */}
            <div className="scroll-quiet scroll-dark -mx-2 hidden min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-2 pb-2 lg:flex">
              <SidebarCards />
              <PortalSection />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex h-16 items-center justify-end px-4 sm:px-8">
              <Suspense>
                <GlobalSearch />
              </Suspense>
            </div>
            <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
