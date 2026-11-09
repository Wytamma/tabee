import { describe, expect, it } from "vitest";
import {
  createInviteUrl,
  helloAckMessage,
  helloMessage,
  parseInvite,
  readHandshakeMessage,
  stripInvite,
} from "../src/handshake.js";

const sid = "0123456789abcdef0123456789abcdef";

describe("invite URLs", () => {
  it("adds handshake parameters without losing the application hash", () => {
    const url = new URL("https://treeviewer.example/app#/tree/42");
    const invite = createInviteUrl(url, sid);
    const parsed = new URL(invite);
    expect(parsed.origin).toBe("https://treeviewer.example");
    expect(parsed.pathname).toBe("/app");
    expect(parseInvite(parsed.hash)?.sid).toBe(sid);
    expect(parsed.hash).toContain("tabee=1");
    expect(new URLSearchParams(parsed.hash.slice(1)).get("tabee-sid")).toBe(sid);
  });

  it("round-trips through stripInvite, keeping unrelated parameters", () => {
    const withInvite = createInviteUrl(new URL("https://a.example/path#view=tree&zoom=3"), sid);
    const stripped = stripInvite(new URL(withInvite).hash);
    const params = new URLSearchParams(remaining(stripped));
    expect(params.get("tabee")).toBeNull();
    expect(params.get("tabee-sid")).toBeNull();
    expect(params.get("zoom")).toBe("3");
    expect(params.get("view")).toBe("tree");
  });

  it("returns an empty hash when nothing else was present", () => {
    expect(stripInvite("#tabee=1&tabee-sid=0123456789abcdef0123456789abcdef")).toBe("");
  });
});

describe("parseInvite", () => {
  it("ignores pages that are not tabEE invites", () => {
    expect(parseInvite("")).toBeUndefined();
    expect(parseInvite("#/route")).toBeUndefined();
    expect(parseInvite("#tabee=0&tabee-sid=0123456789abcdef0123456789abcdef")).toBeUndefined();
  });

  it("rejects a missing, malformed, or wrong-length nonce", () => {
    expect(parseInvite("#tabee=1")).toBeUndefined();
    expect(parseInvite("#tabee=1&tabee-sid=not-hex")).toBeUndefined();
    expect(parseInvite("tabee=1&tabee-sid=0123")).toBeUndefined();
    expect(parseInvite(`#tabee=1&tabee-sid=${"A".repeat(32)}`)).toBeUndefined();
  });
});

describe("readHandshakeMessage", () => {
  it("accepts hello and hello-ack with a valid nonce", () => {
    expect(readHandshakeMessage(helloMessage(sid))?.type).toBe("hello");
    expect(readHandshakeMessage(helloAckMessage(sid))?.type).toBe("hello-ack");
  });

  it.each([
    ["missing namespace", { type: "hello", sid, version: 1 }],
    ["foreign namespace", { namespace: "other", type: "hello", sid, version: 1 }],
    ["unknown type", { namespace: "tabee-handshake", type: "syn", sid, version: 1 }],
    ["unsupported version", { namespace: "tabee-handshake", type: "hello", sid, version: 2 }],
    ["bad sid", { namespace: "tabee-handshake", type: "hello", sid: "x", version: 1 }],
    ["array", []],
    ["null", null],
    ["string", "hello"],
  ])("rejects %s", (_name, value) => {
    expect(readHandshakeMessage(value)).toBeUndefined();
  });
});

function remaining(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}
