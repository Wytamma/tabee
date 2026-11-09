import { createBridge } from "@cdep/browser";
import { NEWICK_V1, normalizeFormatKey, registryCapability } from "@cdep/formats";
import { parseNewick } from "./newick.js";
import { renderTree } from "./render.js";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  session: must<HTMLParagraphElement>("#session"),
  svg: must<SVGSVGElement>("#tree"),
  source: must<HTMLSpanElement>("#source"),
  files: must<HTMLSpanElement>("#files"),
  leaves: must<HTMLSpanElement>("#leaves"),
};

const bridge = createBridge({
  application: { name: "Tree Viewer", url: `${location.origin}${location.pathname}` },
  normalizeFormatKey,
  imports: {
    [NEWICK_V1]: (files, context) => {
      const parsed = files.map((file) => {
        if (typeof file.data !== "string") throw new Error("Newick payload must be text");
        return { name: file.name, tree: parseNewick(file.data) };
      });
      const [first] = parsed;
      if (!first) throw new Error("The transfer contained no files");

      const layout = renderTree(elements.svg, first.tree);
      elements.leaves.textContent = `${layout.leaves} leaves`;
      elements.leaves.dataset.count = String(layout.leaves);
      elements.files.textContent = parsed.length === 1 ? "1 file" : `${parsed.length} files`;
      elements.files.dataset.count = String(parsed.length);
      elements.source.textContent = `Received from ${context.senderApplication} (${context.senderOrigin})`;
    },
  },
  importCapabilities: {
    [NEWICK_V1]: registryCapability(NEWICK_V1),
  },
  onState: (snapshot) => {
    elements.session.dataset.state = snapshot.state;
    elements.session.textContent =
      snapshot.state === "IMPORTED"
        ? `Imported "${snapshot.datasetName}".`
        : `Incoming "${snapshot.datasetName}" (${snapshot.fileCount} file(s), ${snapshot.formats.join(", ")}): ${snapshot.state}`;
  },
  onError: (error) => {
    elements.session.dataset.state = "FAILED";
    elements.session.textContent = `Receiver error — ${error.code}: ${error.message}`;
  },
});

if (bridge.receiver) {
  elements.session.textContent = "Waiting for a sender to propose a dataset…";
  elements.session.dataset.state = "CONNECTED";
}
