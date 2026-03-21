import Link from "next/link";
import { MainListView } from "@/components/home/MainListView";

export default function LegacyHomePage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl justify-end px-4 pt-4">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          New UI
        </Link>
      </div>
      <MainListView appBasePath="/legacy" />
    </div>
  );
}
