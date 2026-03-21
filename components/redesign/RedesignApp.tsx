"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import artifactsIcon from "@/components/icons/artifacts.svg";
import backIcon from "@/components/icons/back.svg";
import chatIcon from "@/components/icons/chat.svg";
import chevronIcon from "@/components/icons/chevron.svg";
import rawTranscriptIcon from "@/components/icons/raw-transcript.svg";
import transcriptIcon from "@/components/icons/transcript.svg";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { ProjectTemplatePanel } from "@/components/projects/ProjectTemplatePanel";
import { RedesignRecordingPanel } from "@/components/redesign/RedesignRecordingPanel";
import {
  parseProcessingTemplate,
  type ProcessingTemplate,
} from "@/lib/projects/processingTemplate";
import {
  createPlaceholderProject,
  fetchProjects,
  fetchProjectClient,
  fetchProjectRecordingsClient,
  fetchRecordingsSummaryClient,
} from "@/lib/api/projects";
import {
  parseRedesignState,
  serializeRedesignState,
  type RedesignUiState,
  type RecordingTabId,
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

  const statsQuery = useQuery({
    queryKey: ["redesign-stats", projectId],
    queryFn: () => fetchRecordingsSummaryClient(projectId!),
    enabled: Boolean(projectId) && (ui.view === "project" || ui.view === "recording"),
  });

  const recordingsQuery = useQuery({
    queryKey: ["projectRecordings", projectId],
    queryFn: () => fetchProjectRecordingsClient(projectId!),
    enabled: Boolean(projectId) && (ui.view === "project" || ui.view === "recording"),
  });

  const projects = projectsQuery.data ?? [];
  const project = projectQuery.data ?? null;
  const stats = statsQuery.data ?? { total: 0, transcribed: 0, pending: 0 };
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

  const setRecordingTab = (tab: RecordingTabId) => {
    if (ui.view !== "recording" || !ui.projectId || !ui.recordingId) {
      return;
    }
    replaceState({
      ...ui,
      recordingTab: tab,
    });
  };

  const processingTemplate: ProcessingTemplate = project
    ? parseProcessingTemplate(project.processing_template)
    : { preset: "summary", customInstructions: null };

  const activeRecordingRow =
    ui.recordingId != null
      ? recordings.find((r) => r.id === ui.recordingId)
      : undefined;

  return (
    <div className="dark relative flex min-h-dvh min-h-full flex-1 flex-col bg-[#07080c] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />

      <header className="relative z-10 flex items-center justify-end gap-3 px-4 pt-3 pb-1">
        <Link
          href="/legacy"
          className="pointer-events-auto text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
        >
          Classic UI
        </Link>
      </header>

      {recordSessionError ? (
        <div className="relative z-10 mx-auto w-full max-w-lg px-4">
          <p
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-100"
          >
            {recordSessionError}
          </p>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-32 pt-2">
        {/* Top: cover — grows to fill space above optional middle + fixed bottom bar */}
        <section className="flex min-h-0 flex-1 flex-col">
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/95 via-slate-900/70 to-slate-600/25 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-black/40 to-transparent" />

            <div className="relative flex min-h-0 flex-1 flex-col">
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
                    onClick={() =>
                      replaceState({
                        view: "projects",
                        projectId: null,
                        recordingId: null,
                        projectDetail: "default",
                        recordingTab: "formatted",
                      })
                    }
                    className="mt-6 self-start rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur hover:bg-white/10"
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
                  className="flex min-h-0 flex-1 flex-col gap-2"
                >
                  <p className="text-xs font-medium text-sky-200/70">Welcome back, Alex</p>
                  <h1 className="text-2xl font-semibold text-white">All Projects</h1>
                  <p className="text-sm text-slate-400">
                    {projectsQuery.isLoading ? "…" : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="text-xs text-slate-500">Swipe up on the bar below for quick record</p>
                </motion.div>
              ) : null}

              {ui.view === "project" && project ? (
                <motion.div
                  key={`project-${project.id}-${ui.projectDetail}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="flex min-h-0 flex-1 flex-col gap-3"
                >
                  {ui.projectDetail === "default" ? (
                    <div className="flex gap-2 border-b border-white/10 pb-2">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                        aria-label="Overview"
                      >
                        <SvgIcon src={artifactsIcon} size={20} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border-b-2 border-sky-400 p-2 text-white"
                        aria-label="Summary"
                      >
                        <SvgIcon src={transcriptIcon} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          replaceState({
                            ...ui,
                            projectDetail: "recordings",
                          })
                        }
                        className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                        aria-label="Recordings"
                      >
                        <SvgIcon src={rawTranscriptIcon} />
                      </button>
                    </div>
                  ) : null}

                  <p className="text-xs font-medium uppercase tracking-wide text-sky-200/80">
                    {stats.total} recordings · Last activity {formatTimeAgo(project.updated_at) || "—"}
                  </p>
                  <h1 className="text-xl font-semibold text-white sm:text-2xl">
                    {project.title?.trim() ? project.title : "Untitled project"}
                  </h1>

                  {ui.projectDetail === "default" ? (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {!project.title_locked ? (
                        <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                          <ProjectTemplatePanel
                            key={`${project.id}-${processingTemplate.preset}-${processingTemplate.customInstructions ?? ""}`}
                            projectId={project.id}
                            initial={processingTemplate}
                          />
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-white/10 bg-black/20">
                        <ProjectTabs
                          masterTranscript={project.master_transcript}
                          summary={project.summary}
                        />
                      </div>
                    </div>
                  ) : null}

                  {ui.projectDetail === "chat" ? (
                    <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3">
                      <ChatPanel projectId={project.id} />
                    </div>
                  ) : null}

                  {ui.projectDetail === "recordings" ? (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <p className="mb-2 line-clamp-3 text-sm leading-relaxed text-slate-300">
                        {project.summary?.trim()?.slice(0, 220)}
                        {(project.summary?.length ?? 0) > 220 ? "…" : ""}
                      </p>
                      <div className="h-8 bg-gradient-to-t from-[#07080c] to-transparent" />
                    </div>
                  ) : null}
                </motion.div>
              ) : null}

              {ui.view === "project" && projectId && projectQuery.isFetching && !project ? (
                <motion.div
                  key="project-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center text-sm text-slate-400"
                >
                  Loading project…
                </motion.div>
              ) : null}

              {ui.view === "project" && projectId && !projectQuery.isFetching && !project ? (
                <motion.div
                  key="project-missing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
                >
                  <p className="text-sm text-slate-400">Project not found.</p>
                  <button
                    type="button"
                    onClick={() =>
                      replaceState({
                        view: "projects",
                        projectId: null,
                        recordingId: null,
                        projectDetail: "default",
                        recordingTab: "formatted",
                      })
                    }
                    className="text-sm font-medium text-sky-300 underline"
                  >
                    All projects
                  </button>
                </motion.div>
              ) : null}

              {ui.view === "recording" && ui.projectId && ui.recordingId ? (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="flex min-h-0 flex-1 flex-col gap-2"
                >
                  <p className="text-xs text-slate-400">
                    {activeRecordingRow
                      ? `${formatTimeAgo(activeRecordingRow.created_at)} · `
                      : ""}
                    Recording
                  </p>
                  <h1 className="text-xl font-semibold text-white">
                    {activeRecordingRow?.preview?.trim()?.slice(0, 80) || "Recording"}
                  </h1>
                  <RedesignRecordingPanel
                    projectId={ui.projectId}
                    recordingId={ui.recordingId}
                    recordingTab={ui.recordingTab}
                    onRecordingTabChange={setRecordingTab}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
        </section>

        {/* Middle: scrollable lists — only present on views that show a sheet below the cover */}
        {ui.view === "projects" && !projectsQuery.isLoading ? (
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="mt-4 flex max-h-[40vh] min-h-0 shrink-0 flex-col gap-0 overflow-y-auto rounded-2xl"
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
            className="mt-3 flex max-h-[42vh] min-h-0 shrink-0 flex-col overflow-y-auto rounded-2xl"
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
      </div>

      {/* Primary chrome: tap targets here; sheet drag vs inner scroll can be isolated on this bar later. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-zinc-950/90 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md"
        aria-label="Primary"
        data-redesign-bottom-bar
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          {ui.view === "home" ? (
            <div className="flex flex-1 justify-center">
              <RecordButton
                variant="fab"
                label="Record"
                onClick={() => void beginRecording()}
                disabled={creatingProject}
                className="bg-slate-800 hover:bg-slate-700"
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
                className="bg-slate-800 hover:bg-slate-700"
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
                    replaceState({
                      view: "projects",
                      projectId: null,
                      recordingId: null,
                      projectDetail: "default",
                      recordingTab: "formatted",
                    });
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
                className="bg-slate-800 hover:bg-slate-700"
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
                className="bg-slate-800 hover:bg-slate-700"
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

        {ui.view === "project" && project && ui.projectDetail === "default" ? (
          <div className="mx-auto mt-2 flex max-w-lg justify-center">
            <button
              type="button"
              onClick={() => replaceState({ ...ui, projectDetail: "recordings" })}
              className="text-xs font-medium text-sky-300/90 underline-offset-2 hover:underline"
            >
              Show recordings
            </button>
          </div>
        ) : null}
      </nav>

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
