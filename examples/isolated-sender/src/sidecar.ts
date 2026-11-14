import { createBridge } from "@tabee/browser";
import { NEWICK_V1, normalizeFormatKey, registryCapability } from "@tabee/formats";
import { TabeeException } from "@tabee/protocol";
import { CHANNEL_NAME, readDatasetMessage, type StagedDataset } from "./stage.js";

const DEFAULT_TARGET = "http://localhost:5182/";
const PREVIEW_CHARS = 1_200;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  isolation: must<HTMLSpanElement>("#isolation"),
  isolationWarning: must<HTMLParagraphElement>("#isolation-warning"),
  sealed: must<HTMLSpanElement>("#sealed"),
  stagedName: must<HTMLElement>("#staged-name"),
  stagedMeta: must<HTMLElement>("#staged-meta"),
  preview: must<HTMLPreElement>("#tree-preview"),
  form: must<HTMLFormElement>("#send-form"),
  target: must<HTMLInputElement>("#target"),
  targetOrigin: must<HTMLSpanElement>("#target-origin"),
  send: must<HTMLButtonElement>("#send"),
  status: must<HTMLParagraphElement>("#status"),
};

const isolated = self.crossOriginIsolated;
elements.isolation.textContent = isolated ? "Cross-origin isolated" : "Not isolated";
elements.isolation.dataset.isolated = String(isolated);
elements.isolationWarning.hidden = !isolated;

const opener = window.opener;
elements.sealed.textContent = opener === null ? "severed" : "present";

elements.target.value = import.meta.env.VITE_TARGET_URL ?? DEFAULT_TARGET;

let staged: StagedDataset | undefined;
let stagedBytes = 0;
/** Snapshot chosen by the Send click, so a late staging cannot swap payloads. */
let pending: StagedDataset | undefined;

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  const kib = bytes / 1_024;
  if (kib < 1_024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1_024).toFixed(1)} MiB`;
}

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function describeError(error: unknown): string {
  if (error instanceof TabeeException) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

function readTargetOrigin(): string | undefined {
  try {
    const url = new URL(elements.target.value.trim());
    return url.origin === "null" ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

function renderTarget(): void {
  const origin = readTargetOrigin();
  elements.targetOrigin.textContent = origin ?? "invalid URL";
  elements.targetOrigin.dataset.valid = String(origin !== undefined);
  elements.send.disabled = staged === undefined || origin === undefined;
  elements.send.textContent = origin === undefined ? "Send" : `Send to ${origin}`;
}

function renderStaged(): void {
  if (staged === undefined) {
    elements.stagedName.textContent = "Nothing staged";
    elements.stagedMeta.textContent = "Stage a tree in the app tab.";
    elements.preview.textContent = "";
  } else {
    elements.stagedName.textContent = staged.datasetName;
    elements.stagedMeta.textContent = `${staged.fileName} · ${formatBytes(stagedBytes)}`;
    elements.preview.textContent =
      staged.newick.length > PREVIEW_CHARS
        ? `${staged.newick.slice(0, PREVIEW_CHARS)}\n…`
        : staged.newick;
  }
  renderTarget();
}

const bridge = createBridge({
  application: {
    name: "Isolated Sender exchange tab",
    url: `${location.origin}${location.pathname}`,
  },
  normalizeFormatKey,
  exports: {
    [NEWICK_V1]: () => {
      const dataset = pending ?? staged;
      if (dataset === undefined) throw new Error("No tree is staged");
      return {
        name: dataset.datasetName,
        files: [{ name: dataset.fileName, data: dataset.newick }],
      };
    },
  },
  exportCapabilities: {
    [NEWICK_V1]: registryCapability(NEWICK_V1),
  },
});

const channel = new BroadcastChannel(CHANNEL_NAME);
channel.postMessage({ type: "hello" });

channel.addEventListener("message", (event: MessageEvent) => {
  const dataset = readDatasetMessage(event.data);
  if (dataset === undefined) return;
  if (staged !== undefined && dataset.stagedAt < staged.stagedAt) return;

  staged = dataset;
  stagedBytes = new Blob([dataset.newick]).size;
  renderStaged();
  setStatus("Tree staged. Press Send when ready.");
});

elements.target.addEventListener("input", renderTarget);

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (staged === undefined) return;
  if (readTargetOrigin() === undefined) {
    setStatus("Enter a valid destination URL.", "error");
    return;
  }

  // `sendTo` opens the receiver synchronously; this click is its user gesture.
  pending = staged;
  elements.send.disabled = true;
  setStatus("Opening the receiving tab…");

  void bridge
    .sendTo(elements.target.value.trim(), { format: "newick" })
    .then((receipt) => {
      setStatus(
        `Imported ${receipt.fileCount} file(s), ${formatBytes(receipt.sizeBytes)} (${receipt.formats.join(", ")}), transfer ${receipt.transferId.slice(0, 8)}…`,
      );
    })
    .catch((error: unknown) => {
      setStatus(`Transfer failed — ${describeError(error)}`, "error");
    })
    .finally(() => {
      pending = undefined;
      renderTarget();
    });
});

addEventListener("pagehide", () => {
  channel.postMessage({ type: "bye" });
  bridge.destroy();
});

renderStaged();
setStatus("Waiting for a tree to be staged in the app tab.");
