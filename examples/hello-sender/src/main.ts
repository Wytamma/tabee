import { createBridge } from "@tabee/browser";
import { TabeeException } from "@tabee/protocol";

/**
 * Any valid format identifier works; the proposed registry is not a
 * requirement. Both apps declare this exact string, and that is the whole
 * agreement. Compatibility is exact-string equality, never content sniffing.
 */
const TEXT_V1 = "org.example.format.text.v1";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

const elements = {
  message: must<HTMLTextAreaElement>("#message"),
  target: must<HTMLInputElement>("#target"),
  form: must<HTMLFormElement>("#send-form"),
  status: must<HTMLParagraphElement>("#status"),
};

const bridge = createBridge({
  application: { name: "Hello Sender", url: `${location.origin}${location.pathname}` },
  exports: {
    [TEXT_V1]: () => ({
      name: "hello.txt",
      files: [{ name: "hello.txt", data: elements.message.value }],
    }),
  },
});

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (elements.message.value.trim() === "") {
    setStatus("Type a message first.", "error");
    return;
  }
  setStatus("Opening the receiver…");
  bridge
    .sendTo(elements.target.value, { format: TEXT_V1 })
    .then((receipt) => {
      setStatus(
        `Delivered ${receipt.sizeBytes} bytes as ${receipt.formats.join(", ")} (transfer ${receipt.transferId.slice(0, 8)}…).`,
      );
    })
    .catch((error: unknown) => {
      const message =
        error instanceof TabeeException
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      setStatus(`Transfer failed — ${message}`, "error");
    });
});
