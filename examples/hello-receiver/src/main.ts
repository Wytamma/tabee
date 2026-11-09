import { createBridge } from "@tabee/browser";

/** Must match the sender byte for byte; this string is the entire contract. */
const TEXT_V1 = "org.example.format.text.v1";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  session: must<HTMLParagraphElement>("#session"),
  message: must<HTMLPreElement>("#message"),
};

const bridge = createBridge({
  application: { name: "Hello Receiver", url: `${location.origin}${location.pathname}` },
  imports: {
    [TEXT_V1]: (files, context) => {
      elements.message.textContent = files
        .map((file) => {
          if (typeof file.data !== "string") throw new Error("Expected text data");
          return file.data;
        })
        .join("\n");
      elements.session.dataset.state = "IMPORTED";
      elements.session.textContent = `Received ${files.length} file(s) from ${context.senderApplication} (${context.senderOrigin}).`;
    },
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
