import { Suspense } from "react";
import { RedesignApp } from "@/components/redesign/RedesignApp";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="dark flex h-dvh items-center justify-center bg-[#07080c] text-slate-400">
          Loading…
        </div>
      }
    >
      <RedesignApp />
    </Suspense>
  );
}
