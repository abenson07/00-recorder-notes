export type RedesignView = "home" | "projects" | "project" | "recording";

export type ProjectDetailMode = "default" | "recordings" | "chat";

export type RecordingTabId = "artifacts" | "formatted" | "raw";

export type RedesignUiState = {
  view: RedesignView;
  projectId: string | null;
  recordingId: string | null;
  projectDetail: ProjectDetailMode;
  recordingTab: RecordingTabId;
};

const TAB_IDS: RecordingTabId[] = ["artifacts", "formatted", "raw"];

function parseRecordingTab(raw: string | null): RecordingTabId {
  if (raw && TAB_IDS.includes(raw as RecordingTabId)) {
    return raw as RecordingTabId;
  }
  return "formatted";
}

function parseProjectDetail(raw: string | null): ProjectDetailMode {
  if (raw === "recordings" || raw === "chat") {
    return raw;
  }
  return "default";
}

function parseView(raw: string | null): RedesignView {
  if (raw === "projects" || raw === "project" || raw === "recording" || raw === "home") {
    return raw;
  }
  return "home";
}

export function parseRedesignState(searchParams: URLSearchParams): RedesignUiState {
  const projectId = searchParams.get("projectId");
  const recordingId = searchParams.get("recordingId");
  const viewRaw = searchParams.get("view");

  let view = parseView(viewRaw);

  if (recordingId && projectId) {
    view = "recording";
  } else if (view === "recording") {
    view = projectId ? "project" : "home";
  }

  if (view === "project" && !projectId) {
    view = "projects";
  }

  return {
    view,
    projectId,
    recordingId: recordingId && projectId ? recordingId : null,
    projectDetail: parseProjectDetail(searchParams.get("detail")),
    recordingTab: parseRecordingTab(searchParams.get("recordingTab")),
  };
}

export function serializeRedesignState(s: RedesignUiState): string {
  const p = new URLSearchParams();

  if (s.view === "home") {
    return "";
  }

  p.set("view", s.view);

  if (s.projectId) {
    p.set("projectId", s.projectId);
  }
  if (s.recordingId) {
    p.set("recordingId", s.recordingId);
  }

  if (s.view === "project") {
    if (s.projectDetail === "recordings") {
      p.set("detail", "recordings");
    } else if (s.projectDetail === "chat") {
      p.set("detail", "chat");
    }
  }

  if (s.view === "recording") {
    if (s.recordingTab !== "formatted") {
      p.set("recordingTab", s.recordingTab);
    }
  }

  return p.toString();
}
