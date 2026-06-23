import { MainListView } from "@/components/home/MainListView";
import { HomeUnsortedView } from "@/components/mobile/HomeUnsortedView";

export default function HomePage() {
  return (
    <>
      <HomeUnsortedView />
      <div className="hidden md:flex md:flex-1 md:flex-col">
        <MainListView />
      </div>
    </>
  );
}
