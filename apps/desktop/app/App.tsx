import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "preact/hooks";
import { useFileDrop } from "../../web/src/board/useFileDrop";
import { dictionaries } from "../../web/src/i18n";
import { type ToolId, tools } from "../../web/src/tools";
import { accepted } from "./files";
import { Monastery } from "./Monastery";
import { findTools, isTool } from "./search";
import { inTauri, lang, platform } from "./shell";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";
import { ToolScreen } from "./ToolScreen";

const images = ["jpg", "jpeg", "png", "heic", "heif"];

function HomeDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  useFileDrop(onFiles);
  return null;
}

export function App() {
  const [tool, setTool] = useState<ToolId | null>(null);
  const [arrived, setArrived] = useState<File[]>([]);
  const [handed, setHanded] = useState<File[] | undefined>();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const t = dictionaries[lang];

  useEffect(() => {
    if (inTauri) void getCurrentWindow().setTitle(tool ? t.toolNames[tool] : "Holy PDF");
  }, [tool]);

  useEffect(() => {
    if (!inTauri) return;
    const stopping = listen<string>("menu", ({ payload }) => {
      setNotice(null);
      command(payload).catch((problem: unknown) => setNotice(problem instanceof Error ? problem.message : String(problem)));
    });
    return () => void stopping.then((stop) => stop());
  }, [tool]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (platform === "mac" ? !event.metaKey : !event.ctrlKey) return;
      if (event.key === "f" || event.key === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#search")?.focus();
      } else if (event.key === "[") {
        event.preventDefault();
        home();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  async function command(id: string) {
    if (id === "open") receive(await pick());
    else if (id === "undo" || id === "redo") undo(id);
  }

  async function pick(): Promise<File[]> {
    const current = tool ? tools[tool] : null;
    const filters = !current ? [{ name: "PDF, JPEG, PNG, HEIC", extensions: ["pdf", ...images] }]
      : current.convertsImages ? [{ name: "PDF, JPEG, PNG", extensions: ["pdf", "jpg", "jpeg", "png"] }]
      : current.accepts === "pdf" ? [{ name: "PDF", extensions: ["pdf"] }]
      : [{ name: "JPEG, PNG, HEIC", extensions: images }];
    const paths = await open({ multiple: true, filters });
    return Promise.all((paths ?? []).map(async (path) => new File([await readFile(path)], path.split(/[\\/]/).pop() ?? path)));
  }

  /** On a tool, every picked file goes to the board, which says itself what it refuses. */
  function receive(files: File[]) {
    if (files.length === 0) return;
    if (tool) setHanded(files);
    else setArrived(files);
  }

  function openTool(id: ToolId) {
    const kept = accepted(tools[id], arrived);
    setHanded(kept);
    // A tool that takes none of the arrived files leaves them on the monastery for the next one.
    if (kept.length > 0) setArrived([]);
    setQuery("");
    setTool(id);
  }

  function home() {
    setTool(null);
    setHanded(undefined);
    setQuery("");
  }

  const found = findTools(query);
  const matches = (found ?? []).map((match) => match.id).filter(isTool);
  return (
    <>
      <Titlebar tool={tool} query={query} onQuery={setQuery} onHome={home} matches={matches} onOpen={openTool} />
      {notice && <p class="notice" role="alert">{notice}</p>}
      <div class="shell">
        <Sidebar tool={tool} onOpen={openTool} onHome={home} />
        <div class="screen">
          {tool ? (
            <ToolScreen key={tool} id={tool} files={handed} />
          ) : (
            <>
              <HomeDrop onFiles={setArrived} />
              <Monastery found={found} arrived={arrived} onOpen={openTool} onChangeFiles={() => setArrived([])} onReset={() => setQuery("")} />
            </>
          )}
        </div>
      </div>
      <div class="drop-overlay" aria-hidden="true"><p>{dictionaries[lang].drop.release}</p></div>
    </>
  );
}

/** The menu's Undo goes to the text field that has the focus, or to the board, which listens for the shortcut on the window. */
function undo(id: "undo" | "redo") {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    document.execCommand(id);
    return;
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: platform === "mac", ctrlKey: platform !== "mac", shiftKey: id === "redo", bubbles: true }));
}
