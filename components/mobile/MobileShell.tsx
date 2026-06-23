"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { GlobalSearchSection } from "@/components/home/GlobalSearchSection";
import { FloatingNav } from "@/components/mobile/FloatingNav";
import { cn } from "@/lib/cn";

const MOBILE_NAV_ROUTES = ["/", "/tasks", "/projects", "/upload"];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const showMobileNav = MOBILE_NAV_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );

  return (
    <>
      <div
        className={cn(
          "flex min-h-full flex-1 flex-col",
          showMobileNav && "pb-24 md:pb-0",
          showMobileNav && "mobile-theme bg-[#f5f0e8] text-stone-900 dark:bg-stone-950 dark:text-stone-50",
        )}
      >
        {searchOpen && showMobileNav ? (
          <div className="fixed inset-0 z-40 flex flex-col bg-[#f5f0e8]/98 p-4 pt-8 dark:bg-stone-950/98 md:hidden">
            <div className="mx-auto w-full max-w-lg">
              <GlobalSearchSection />
            </div>
          </div>
        ) : null}
        {children}
      </div>
      {showMobileNav ? (
        <FloatingNav
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen((v) => !v)}
        />
      ) : null}
    </>
  );
}
