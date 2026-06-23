"use client";

import Link from "next/link";
import type { ItemListRow } from "@/lib/types";

export function ParentProjectDetailClient({
  projectId,
  title,
  description,
  items,
}: {
  projectId: string;
  title: string;
  description: string | null;
  items: ItemListRow[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <nav className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/projects" className="hover:text-zinc-800 dark:hover:text-zinc-200 md:hidden">
          ← Projects
        </Link>
        <Link href="/" className="hidden hover:text-zinc-800 dark:hover:text-zinc-200 md:inline">
          ← Home
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        {description?.trim() ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No items in this project yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/items/${item.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h2 className="font-medium">{item.title}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.recordings_count} recording{item.recordings_count === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
