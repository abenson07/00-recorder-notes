"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image, { type StaticImageData } from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import backIcon from "@/components/icons/back.svg";
import chatIcon from "@/components/icons/chat.svg";
import chevronIcon from "@/components/icons/chevron.svg";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";
import {
  createPlaceholderProject,
  fetchProjects,
  fetchProjectClient,
  fetchProjectRecordingsClient,
} from "@/lib/api/projects";
import {
  parseRedesignState,
  serializeRedesignState,
  type RedesignUiState,
} from "@/components/redesign/urlState";
import { cn } from "@/lib/cn";
import type { Project, RecordingListItem } from "@/lib/types";
import { recordingStatusLabel } from "@/lib/recording-status";

const HOME_STATE: RedesignUiState = {
  view: "home",
  projectId: null,
  recordingId: null,
  projectDetail: "default",
  recordingTab: "formatted",
};

const PROJECTS_SHEET_STATE: RedesignUiState = {
  view: "projects",
  projectId: null,
  recordingId: null,
  projectDetail: "default",
  recordingTab: "formatted",
};

/** Bottom-bar FAB styling in redesign (overrides RecordButton defaults). */
const REDESIGN_RECORD_FAB_CLASS =
  "h-12 w-12 bg-[#F9FBFA]/20 text-white hover:bg-[#F9FBFA]/30 disabled:hover:bg-[#F9FBFA]/20";

function SvgIcon({
  src,
  className,
  size = 22,
}: {
  src: StaticImageData;
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}

function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) {
      return "just now";
    }
    if (mins < 60) {
      return `${mins} min ago`;
    }
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) {
      return `${hrs} hr ago`;
    }
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return "";
  }
}

export function RedesignApp() {
  const router = useRouter();
  const rawSearch = useSearchParams();
  const searchKey = rawSearch.toString();
  const ui = useMemo(
    () => parseRedesignState(new URLSearchParams(searchKey)),
    [searchKey],
  );

  const replaceState = useCallback(
    (next: RedesignUiState) => {
      const qs = serializeRedesignState(next);
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router],
  );

  const onBottomBarSwipePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const { view, projectDetail, projectId, recordingTab } = ui;
      const canSwipeHomeToProjects = view === "home";
      const canSwipeProjectToRecordings =
        view === "project" && projectDetail === "default";
      if (!canSwipeHomeToProjects && !canSwipeProjectToRecordings) return;

      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;

      const finish = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        const dy = ev.clientY - startY;
        const dx = ev.clientX - startX;
        if (dy <= -40 && Math.abs(dy) > Math.abs(dx)) {
          if (canSwipeHomeToProjects) {
            replaceState(PROJECTS_SHEET_STATE);
          } else if (canSwipeProjectToRecordings && projectId) {
            replaceState({
              view: "project",
              projectId,
              recordingId: null,
              projectDetail: "recordings",
              recordingTab,
            });
          }
        }
      };

      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", finish);
    },
    [ui, replaceState],
  );

  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordProjectId, setRecordProjectId] = useState<string | null>(null);
  const [recordSessionError, setRecordSessionError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const projectId = ui.projectId ?? undefined;
  const projectQuery = useQuery({
    queryKey: ["redesign-project", projectId],
    queryFn: () => fetchProjectClient(projectId!),
    enabled: Boolean(projectId) && (ui.view === "project" || ui.view === "recording"),
  });

  const recordingsQuery = useQuery({
    queryKey: ["projectRecordings", projectId],
    queryFn: () => fetchProjectRecordingsClient(projectId!),
    enabled: Boolean(projectId) && (ui.view === "project" || ui.view === "recording"),
  });

  const projects = projectsQuery.data ?? [];
  const project = projectQuery.data ?? null;
  const recordings: RecordingListItem[] = recordingsQuery.data ?? [];

  const beginRecording = async () => {
    setRecordSessionError(null);
    setCreatingProject(true);
    try {
      const id = await createPlaceholderProject();
      setRecordProjectId(id);
      setRecordOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      setRecordSessionError(
        e instanceof Error ? e.message : "Could not start recording. Try again.",
      );
    } finally {
      setCreatingProject(false);
    }
  };

  const openRecording = (pid: string, rid: string) => {
    replaceState({
      view: "recording",
      projectId: pid,
      recordingId: rid,
      projectDetail: ui.projectDetail,
      recordingTab: "formatted",
    });
  };

  const showProjectsSheet =
    ui.view === "projects" && !projectsQuery.isLoading;
  const showRecordingsSheet =
    ui.view === "project" &&
    ui.projectDetail === "recordings" &&
    project != null;
  /** Project / recording routes: compact cover band; content is below */
  const coverCollapsed =
    showProjectsSheet ||
    showRecordingsSheet ||
    (ui.view === "project" && projectId != null) ||
    (ui.view === "recording" &&
      ui.projectId != null &&
      ui.recordingId != null);

  const hasMiddleSection = showProjectsSheet || showRecordingsSheet;

  return (
    <div className="dark relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-[#07080c] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden pt-2 px-4 pb-8">
        {recordSessionError ? (
          <div className="mx-auto w-full max-w-lg shrink-0">
            <p
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-100"
            >
              {recordSessionError}
            </p>
          </div>
        ) : null}

        {/* Top: fills space above middle + bottom; min height when middle is visible */}
        <section
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden",
            hasMiddleSection && "min-h-[250px]",
          )}
        >
          <motion.div
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className={cn(
              "relative mx-auto flex min-h-[250px] w-full max-w-[408px] flex-1 flex-col items-stretch gap-2 self-stretch overflow-hidden rounded-3xl bg-[linear-gradient(180deg,#030406_0%,#143443_32.21%,#878B8A_100%)] px-8",
              coverCollapsed
                ? "justify-start pt-[72px] pb-10"
                : "min-h-0 justify-center py-0",
            )}
          >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {ui.view === "home" ? (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-1 flex-col justify-center gap-3"
                >
                  <p className="text-sm font-medium text-sky-200/80">Hello, Alex</p>
                  <h1 className="max-w-sm text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                    What are we discussing today?
                  </h1>
                  <button
                    type="button"
                    onClick={() => replaceState(PROJECTS_SHEET_STATE)}
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-24 focus:z-[100] focus:m-0 focus:inline-flex focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-lg focus:border focus:border-white/20 focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    All projects
                  </button>
                </motion.div>
              ) : null}

              {ui.view === "projects" ? (
                <motion.div
                  key="projects"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "flex flex-col gap-2",
                    !coverCollapsed && "min-h-0 flex-1 overflow-hidden",
                  )}
                >
                  <p className="text-xs font-medium text-sky-200/70">Welcome back, Alex</p>
                  <h1 className="text-2xl font-semibold text-white">All Projects</h1>
                  <p className="text-sm text-slate-400">
                    {projectsQuery.isLoading ? "…" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Tap the record button below to capture a note.
                  </p>
                </motion.div>
              ) : null}

              {ui.view === "project" && projectId ? (
                <motion.div
                  key={`project-cover-${projectId}-${ui.projectDetail}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  {ui.projectDetail === "default" ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
                      <button
                        type="button"
                        onClick={() =>
                          replaceState({ ...ui, projectDetail: "recordings" })
                        }
                        className="text-xs font-medium text-sky-300/90 underline-offset-2 hover:underline"
                      >
                        Show recordings
                      </button>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1" aria-hidden />
                  )}
                </motion.div>
              ) : null}

              {ui.view === "recording" && ui.projectId && ui.recordingId ? (
                <motion.div
                  key={`recording-cover-${ui.recordingId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="min-h-0 flex-1"
                  aria-hidden
                />
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
        </section>

        {/* Middle: intrinsic height; shrinks and scrolls when space is tight */}
        {ui.view === "projects" && !projectsQuery.isLoading ? (
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="relative flex min-h-0 shrink flex-col gap-0 overflow-y-auto rounded-2xl"
          >
            {projects.map((p: Project) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    replaceState({
                      view: "project",
                      projectId: p.id,
                      recordingId: null,
                      projectDetail: "default",
                      recordingTab: "formatted",
                    })
                  }
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5 text-left">
                    <span className="truncate text-[15px] font-medium leading-snug text-white">
                      {p.title?.trim() ? p.title : "Untitled project"}
                    </span>
                    <span className="truncate text-[11px] font-medium uppercase leading-snug tracking-[0.04em] text-zinc-500">
                      {(() => {
                        const n = p.recordings_count ?? 0;
                        const rec =
                          n === 1 ? "1 recording" : `${n} recordings`;
                        const when = formatTimeAgo(p.updated_at) || "—";
                        return `${rec} • ${when}`.toUpperCase();
                      })()}
                    </span>
                  </div>
                  <SvgIcon src={chevronIcon} size={20} />
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}

        {ui.view === "project" && ui.projectDetail === "recordings" && project ? (
          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex min-h-0 shrink flex-col overflow-y-auto rounded-2xl"
          >
            {recordings.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No recordings yet</li>
            ) : (
              recordings.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openRecording(project.id, r.id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5 text-left">
                      <span className="truncate text-[15px] font-medium leading-snug text-white">
                        {r.preview?.trim()?.slice(0, 120) || "Recording"}
                      </span>
                      <span className="truncate text-[11px] font-medium uppercase leading-snug tracking-[0.04em] text-zinc-500">
                        {`${recordingStatusLabel(r.status)} · ${formatTimeAgo(r.created_at) || "—"}`.toUpperCase()}
                      </span>
                    </div>
                    <SvgIcon src={chevronIcon} size={20} />
                  </button>
                </li>
              ))
            )}
          </motion.ul>
        ) : null}

        {/* Bottom: fixed 88px chrome row */}
        <nav
          className={cn(
            "relative z-40 flex h-[88px] shrink-0 flex-col justify-center border-t border-white/5 bg-zinc-950/90 px-6 backdrop-blur-md",
            (ui.view === "home" ||
              (ui.view === "project" && ui.projectDetail === "default")) &&
              "touch-pan-y",
          )}
          aria-label="Primary"
          data-redesign-bottom-bar
          onPointerDown={onBottomBarSwipePointerDown}
        >
          <div className="mx-auto flex h-12 w-full max-w-lg items-center justify-between gap-4">
          {ui.view === "home" ? (
            <div className="flex flex-1 justify-center">
              <RecordButton
                variant="fab"
                label="Record"
                onClick={() => void beginRecording()}
                disabled={creatingProject}
                className={REDESIGN_RECORD_FAB_CLASS}
              />
            </div>
          ) : null}

          {ui.view === "projects" ? (
            <>
              <button
                type="button"
                onClick={() => replaceState(HOME_STATE)}
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                aria-label="Back to home"
              >
                <SvgIcon src={backIcon} />
              </button>
              <RecordButton
                variant="fab"
                label="Record"
                onClick={() => void beginRecording()}
                disabled={creatingProject}
                className={REDESIGN_RECORD_FAB_CLASS}
              />
              <div className="h-12 w-12" aria-hidden />
            </>
          ) : null}

          {ui.view === "project" && project ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (ui.projectDetail === "recordings") {
                    replaceState({ ...ui, projectDetail: "default" });
                  } else if (ui.projectDetail === "chat") {
                    replaceState({ ...ui, projectDetail: "default" });
                  } else {
                    replaceState(PROJECTS_SHEET_STATE);
                  }
                }}
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                aria-label="Back"
              >
                <SvgIcon src={backIcon} />
              </button>
              <RecordButton
                variant="fab"
                label="Record"
                onClick={() => {
                  setRecordProjectId(project.id);
                  setRecordOpen(true);
                }}
                disabled={creatingProject}
                className={REDESIGN_RECORD_FAB_CLASS}
              />
              <button
                type="button"
                onClick={() =>
                  replaceState({
                    ...ui,
                    projectDetail: ui.projectDetail === "chat" ? "default" : "chat",
                  })
                }
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center",
                  ui.projectDetail === "chat" ? "text-sky-400" : "text-zinc-100",
                )}
                aria-label="Chat"
              >
                <SvgIcon src={chatIcon} />
              </button>
            </>
          ) : null}

          {ui.view === "recording" && ui.projectId ? (
            <>
              <button
                type="button"
                onClick={() =>
                  replaceState({
                    view: "project",
                    projectId: ui.projectId,
                    recordingId: null,
                    projectDetail: "recordings",
                    recordingTab: "formatted",
                  })
                }
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                aria-label="Back"
              >
                <SvgIcon src={backIcon} />
              </button>
              <RecordButton
                variant="fab"
                label="Record"
                onClick={() => {
                  setRecordProjectId(ui.projectId);
                  setRecordOpen(true);
                }}
                disabled={creatingProject}
                className={REDESIGN_RECORD_FAB_CLASS}
              />
              <button
                type="button"
                onClick={() =>
                  replaceState({
                    view: "project",
                    projectId: ui.projectId,
                    recordingId: null,
                    projectDetail: "chat",
                    recordingTab: "formatted",
                  })
                }
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                aria-label="Chat"
              >
                <SvgIcon src={chatIcon} />
              </button>
            </>
          ) : null}
          </div>
        </nav>
      </div>

      <RecordModal
        open={recordOpen}
        projectId={recordProjectId}
        onOpenChange={(next) => {
          setRecordOpen(next);
          if (!next) {
            setRecordProjectId(null);
          }
        }}
        onUploaded={async (recordingId) => {
          const pid = recordProjectId;
          setRecordOpen(false);
          setRecordProjectId(null);
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          if (pid) {
            await queryClient.invalidateQueries({ queryKey: ["projectRecordings", pid] });
            await queryClient.invalidateQueries({
              queryKey: ["recording", pid, recordingId],
            });
            replaceState({
              view: "recording",
              projectId: pid,
              recordingId,
              projectDetail: "default",
              recordingTab: "formatted",
            });
          }
        }}
      />
    </div>
  );
}
