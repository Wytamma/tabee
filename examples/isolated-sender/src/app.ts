import {
  CHANNEL_NAME,
  EXCHANGE_WINDOW_NAME,
  checkNewick,
  isExchangeMessage,
  type StagedDataset,
} from "./stage.js";

const DEMO_TREE = "((sample_1:0.12,sample_2:0.08):0.15,sample_3:0.21,sample_4:0.33);";

/**
 * With COOP, a named window opened by this page lands in another browsing
 * context group, so the name is not reused: calling `window.open` on every
 * staging would spawn a tab per click. Only reopen after a cooldown, and let
 * the exchange page's hello/bye messages track whether it is already there.
 */
const REOPEN_COOLDOWN_MS = 5_000;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  editor: must<HTMLTextAreaElement>("#tree-editor"),
  treeStatus: must<HTMLParagraphElement>("#tree-status"),
  isolation: must<HTMLSpanElement>("#isolation"),
  stage: must<HTMLButtonElement>("#stage"),
  status: must<HTMLParagraphElement>("#status"),
  exchangeState: must<HTMLParagraphElement>("#exchange-state"),
  exchangeLink: must<HTMLAnchorElement>("#open-exchange"),
};

const exchangeUrl = new URL("sidecar.html", location.href).href;
elements.exchangeLink.href = exchangeUrl;

elements.isolation.textContent = self.crossOriginIsolated
  ? "Cross-origin isolated"
  : "Not isolated (headers absent)";
elements.isolation.dataset.isolated = String(self.crossOriginIsolated);

const channel = new BroadcastChannel(CHANNEL_NAME);
let staged: StagedDataset | undefined;
let exchangeOpen = false;
let openedAt = 0;

function renderExchangeState(): void {
  elements.exchangeState.textContent = exchangeOpen
    ? "Exchange tab connected."
    : "Exchange tab not connected.";
  elements.exchangeState.dataset.open = String(exchangeOpen);
}

function renderDraftStatus(): void {
  const problem = checkNewick(elements.editor.value);
  elements.treeStatus.textContent = problem ?? "Structurally valid";
  elements.treeStatus.dataset.valid = String(problem === undefined);
  elements.editor.setAttribute("aria-invalid", String(problem !== undefined));
}

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

channel.addEventListener("message", (event: MessageEvent) => {
  if (!isExchangeMessage(event.data)) return;

  if (event.data.type === "bye") {
    exchangeOpen = false;
    renderExchangeState();
    return;
  }

  exchangeOpen = true;
  renderExchangeState();
  // The exchange page may have opened after a tree was staged.
  if (staged) channel.postMessage({ type: "dataset", dataset: staged });
  if (staged) setStatus("Staged. Press Send in the exchange tab.");
});

elements.editor.addEventListener("input", renderDraftStatus);

elements.stage.addEventListener("click", () => {
  const problem = checkNewick(elements.editor.value);
  if (problem !== undefined) {
    renderDraftStatus();
    setStatus(`Fix the Newick draft — ${problem}`, "error");
    return;
  }

  staged = {
    datasetName: "isolated-sender tree",
    fileName: "tree.nwk",
    newick: elements.editor.value.trim(),
    stagedAt: Date.now(),
  };
  channel.postMessage({ type: "dataset", dataset: staged });

  if (!exchangeOpen && Date.now() - openedAt > REOPEN_COOLDOWN_MS) {
    openedAt = Date.now();
    window.open(exchangeUrl, EXCHANGE_WINDOW_NAME);
  }

  setStatus("Staged. Switch to the exchange tab and press Send.");
});

elements.editor.value = DEMO_TREE;
renderDraftStatus();
renderExchangeState();
