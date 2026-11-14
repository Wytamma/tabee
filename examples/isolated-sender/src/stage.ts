/**
 * Handoff between the isolated app document and the exchange page.
 *
 * The app cannot call `window.open` and keep the handle (COOP), so it stages
 * the dataset in a same-origin BroadcastChannel and the exchange page — which
 * is served without COOP — performs the tabEE send.
 *
 * BroadcastChannel is origin-scoped, so every page on this origin can read the
 * messages. The exchange page therefore treats the payload as untrusted input
 * and shows exactly what it is about to send.
 */

export const CHANNEL_NAME = "tabee-isolated-sender";
export const EXCHANGE_WINDOW_NAME = "tabee-exchange";

/** Absolute ceiling for a staged tree (tabEE's default bridge limit). */
export const MAX_NEWICK_BYTES = 10 * 1024 * 1024;

export interface StagedDataset {
  datasetName: string;
  fileName: string;
  newick: string;
  /** Epoch milliseconds; the exchange page keeps the newest staging. */
  stagedAt: number;
}

export type AppMessage = { type: "dataset"; dataset: StagedDataset };
export type ExchangeMessage = { type: "hello" } | { type: "bye" };

export function isExchangeMessage(value: unknown): value is ExchangeMessage {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value)) return false;
  return value.type === "hello" || value.type === "bye";
}

export function readDatasetMessage(value: unknown): StagedDataset | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if (!("type" in value) || value.type !== "dataset") return undefined;
  if (!("dataset" in value)) return undefined;

  const dataset = value.dataset;
  if (typeof dataset !== "object" || dataset === null) return undefined;
  if (!("datasetName" in dataset) || typeof dataset.datasetName !== "string") {
    return undefined;
  }
  if (!("fileName" in dataset) || typeof dataset.fileName !== "string") {
    return undefined;
  }
  if (!("newick" in dataset) || typeof dataset.newick !== "string") {
    return undefined;
  }
  if (!("stagedAt" in dataset) || typeof dataset.stagedAt !== "number") {
    return undefined;
  }

  const { datasetName, fileName, newick, stagedAt } = dataset;
  if (datasetName === "" || datasetName.length > 200) return undefined;
  if (fileName === "" || fileName.length > 200) return undefined;
  if (!Number.isFinite(stagedAt)) return undefined;
  if (newick === "" || newick.length > MAX_NEWICK_BYTES) return undefined;
  if (new Blob([newick]).size > MAX_NEWICK_BYTES) return undefined;

  return { datasetName, fileName, newick, stagedAt };
}

/**
 * Shallow structural check only, mirroring the Newick Sender example: the
 * receiver parses Newick for real, but an obvious typo should not cost an
 * exchange tab and a click.
 */
export function checkNewick(text: string): string | undefined {
  const draft = text.trim();
  if (draft === "") return "Enter a Newick tree.";
  if (!draft.endsWith(";")) return "A Newick tree must end with ';'.";

  let depth = 0;
  let quoted = false;
  for (const char of draft) {
    if (char === "'") {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) return "Unbalanced ')'.";
    }
  }
  if (quoted) return "Unclosed quoted label.";
  if (depth !== 0) return "Missing ')'.";
  return undefined;
}
