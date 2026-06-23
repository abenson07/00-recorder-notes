import { ProjectsMobileList } from "@/components/mobile/ProjectsMobileList";
import { MainListView } from "@/components/home/MainListView";

export default function ProjectsPage() {
  return (
    <>
      <ProjectsMobileList />
      <div className="hidden md:flex md:flex-1 md:flex-col">
        <MainListView />
      </div>
    </>
  );
}
