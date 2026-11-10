# @tabee/formats

Format identifiers and registry helpers for
[tabEE](https://github.com/Wytamma/tabee).

## Install

```sh
npm install @tabee/formats
```

## Usage

```ts
import { NEWICK_V1, normalizeFormatKey, registryCapability } from "@tabee/formats";

normalizeFormatKey("newick"); // "org.tabee.format.newick.v1"
registryCapability(NEWICK_V1); // { id, label, mediaTypes, extensions }
```

Identifiers name a representation, not a file extension. Compatibility is exact
string equality; media types and extensions are display hints only.

## Documentation

See the [format registry](https://github.com/Wytamma/tabee/blob/main/specification/format-registry.md).

## License

MIT
