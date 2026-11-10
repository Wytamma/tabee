import { createBridge } from "@tabee/browser";
import { NEWICK_V1, normalizeFormatKey, registryCapability } from "@tabee/formats";
import { TabeeException } from "@tabee/protocol";

const DEMO_TREE = "((sample_1:0.12,sample_2:0.08):0.15,sample_3:0.21,sample_4:0.33);";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  editor: must<HTMLTextAreaElement>("#tree-editor"),
  treeStatus: must<HTMLParagraphElement>("#tree-status"),
  target: must<HTMLInputElement>("#target"),
  form: must<HTMLFormElement>("#send-form"),
  status: must<HTMLParagraphElement>("#status"),
};

elements.target.value = import.meta.env.VITE_TARGET_URL ?? "http://localhost:5182/";

/**
 * Shallow structural check only. The receiver parses Newick for real; the
 * sender should not pretend to understand the format, but an obvious typo
 * should not cost a round trip.
 */
function checkDraft(text: string): string | undefined {
  const draft = text.trim();
  if (draft === "") return "Enter a Newick tree.";
  if (!draft.endsWith(";")) return "A Newick tree must end with ';'.";

  let depth = 0;
  for (const char of draft) {
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth < 0) return "Unbalanced ')'.";
    }
  }
  if (depth !== 0) return "Missing ')'.";
  return undefined;
}

function renderDraftStatus(): void {
  const problem = checkDraft(elements.editor.value);
  elements.treeStatus.textContent = problem ?? "Structurally valid";
  elements.treeStatus.dataset.valid = String(problem === undefined);
  elements.editor.setAttribute("aria-invalid", String(problem !== undefined));
}

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function describeError(error: unknown): string {
  if (error instanceof TabeeException) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

const bridge = createBridge({
  application: { name: "Newick Sender", url: `${location.origin}${location.pathname}` },
  normalizeFormatKey,
  exports: {
    [NEWICK_V1]: () => ({
      name: "tree.newick",
      files: [{ name: "tree.nwk", data: elements.editor.value.trim() }],
    }),
  },
  exportCapabilities: {
    [NEWICK_V1]: registryCapability(NEWICK_V1),
  },
});

elements.editor.addEventListener("input", renderDraftStatus);

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const problem = checkDraft(elements.editor.value);
  if (problem !== undefined) {
    renderDraftStatus();
    setStatus(`Fix the Newick draft — ${problem}`, "error");
    return;
  }

  setStatus("Opening the receiver…");
  bridge
    .sendTo(elements.target.value, { format: "newick" })
    .then((receipt) => {
      setStatus(
        `Imported ${receipt.fileCount} file(s) (${receipt.sizeBytes} bytes; ${receipt.formats.join(", ")}) (transfer ${receipt.transferId.slice(0, 8)}…).`,
      );
    })
    .catch((error: unknown) => {
      setStatus(`Transfer failed — ${describeError(error)}`, "error");
    });
});

elements.editor.value = DEMO_TREE;
renderDraftStatus();
