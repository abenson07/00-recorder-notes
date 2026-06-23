"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" strokeLinejoin="round" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M22 12H2" /><path d="M22 6H2" /><path d="M22 18H2" /><path d="M6 6v.01" /><path d="M6 12v.01" /><path d="M6 18v.01" />
    </svg>
  );
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 2v4" /><path d="m6.8 15-3.5 2" /><path d="m20.7 17-3.5-2" /><path d="M6.8 9 3.3 7" /><path d="m20.7 7-3.5 2" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/tasks", label: "Tasks", icon: TasksIcon },
  { href: "/projects", label: "Projects", icon: ProjectsIcon },
  { href: "/upload", label: "Upload", icon: UploadIcon },
] as const;

export function FloatingNav({
  searchOpen,
  onSearchToggle,
}: {
  searchOpen?: boolean;
  onSearchToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 md:hidden">
      <nav
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-stone-700/50 bg-stone-900/90 px-2 py-2 shadow-xl backdrop-blur-md"
        aria-label="Main navigation"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                active
                  ? "bg-stone-700 text-orange-100"
                  : "text-stone-300 hover:bg-stone-800 hover:text-stone-50",
              )}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>
      {onSearchToggle ? (
        <button
          type="button"
          onClick={onSearchToggle}
          aria-label="Search"
          aria-pressed={searchOpen}
          className={cn(
            "pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-stone-700/50 bg-stone-900/90 text-stone-100 shadow-xl backdrop-blur-md transition-colors",
            searchOpen && "bg-orange-600 text-white border-orange-500/50",
          )}
        >
          <SearchIcon />
        </button>
      ) : null}
    </div>
  );
}
