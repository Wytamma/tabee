# @tabee/browser

Browser SDK for [tabEE](https://github.com/Wytamma/cdep) — capability discovery,
user-approved dataset transfer, and receipts between two browser applications.

## Install

```sh
npm install @tabee/browser @tabee/formats @tabee/protocol
```

## Usage

```ts
import { createBridge } from "@tabee/browser";
import { NEWICK_V1, normalizeFormatKey } from "@tabee/formats";

const bridge = createBridge({
  application: { name: "Tree Viewer" },
  normalizeFormatKey,
  imports: {
    [NEWICK_V1]: (files) => loadTree(files),
  },
});

await bridge.sendTo("https://treeviewer.example/app", { format: "newick" });
```

`sendTo` must run from a user gesture; it resolves with a receipt only after the
receiver imported the dataset.

## Documentation

See the [project README](https://github.com/Wytamma/cdep#readme) and the
[wire specification](https://github.com/Wytamma/cdep/blob/main/specification/protocol.md).

## License

MIT
