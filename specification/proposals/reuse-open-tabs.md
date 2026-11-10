# Feature proposal: reuse open receiver tabs

**Status:** proposed
**Date:** 2026-11-10
**Scope:** `@tabee/browser`, protocol session lifecycle

## Summary

Let a sender keep a live tabEE session with a receiver it opened, so later
`sendTo` calls reuse that tab instead of opening a new one. Tabs the sender did
not open — including tabs the user opened manually — remain unreachable, which
is a browser security boundary rather than a missing API.

## Motivation

Every `sendTo` currently creates a new receiving tab:

```ts
const sid = randomId();
const receiverWindow = senderWindow.open(createInviteUrl(target, sid), `tabee-${sid}`);
```

The window name is derived from the single-use nonce, so even two sends to the
same destination produce different names and different tabs. The practical
costs are:

- repeated handshakes and consent dialogs when sending several datasets to one
  application;
- the receiver tab count grows with every send;
- in-page state accumulated by the receiver (a loaded tree, table filters,
  viewport) is lost on each new tab.

Linking several datasets into one receiving application is the normal workflow
for tabEE, so the tab-per-send default is the wrong shape.

## Current behaviour

- `sendDataset` opens the destination with a unique window name,
  `tabee-<sid>`, and a single-use invitation nonce
  (`#tabee=1&tabee-sid=…`).
- The sender destroys its Penpal transport in `finally`, after the receipt.
- The receiver keeps its transport alive until `receiver.destroy()`; records
  are keyed by `transferId`, so the receiver implementation already stores
  multiple completed transfers.
- The invitation nonce is stripped from the receiver URL and cannot be replayed,
  so navigating an existing tab to a fresh invite URL always starts a new
  session.

## Browser constraints

The web platform does not provide tab discovery:

- A page cannot enumerate or address arbitrary tabs.
- `window.open("", name)` resolves names only inside the sender's browsing
  context group — windows the sender opened, or their descendants. A manually
  opened receiver tab is in a different group.
- `BroadcastChannel` and `localStorage` are origin-scoped. They cannot connect
  the cross-origin applications tabEE exists to connect.
- A receiver that sets `Cross-Origin-Opener-Policy` severs `window.opener`; tabEE
  already treats that as unsupported for new-window transport.

Consequently there are two distinct capabilities:

| Capability | Feasible |
| --- | --- |
| Reuse a tab this sender opened earlier | yes |
| Discover and reuse a tab the user opened manually | no |

## Options

### Option A — stable window name, navigation reuse

Name the receiving window by destination instead of by nonce, for example
`tabee:https://treeviewer.example/app`, and call `window.open(inviteUrl, name)`
on the next send. The second call navigates the existing tab to the new invite
URL.

Advantages: small sender-only change.

Costs: the receiver reloads, all in-page state is lost, the handshake repeats,
and consent is shown again. It reduces tab count but does not provide session
continuity.

### Option B — persistent session reuse (recommended)

Keep the `WindowProxy` and Penpal transport for each destination, and send
subsequent offers over the existing authenticated channel. No new invite, no
navigation, no reload, no repeat handshake. Consent is still requested per
dataset.

This requires sender and receiver lifecycle work but no new wire operations:
the protocol already allows another `offer` on the same transport.

## Proposed design

### API

```ts
export interface SendOptions {
  format?: string;
  bundle?: string;
  signal?: AbortSignal;
  /**
   * Reuse a live session opened by this bridge for the same destination.
   * Defaults to false while the feature stabilises.
   */
  reuse?: boolean;
}
```

`sendTo` behaviour with `reuse: true`:

1. Look up a session for the normalized destination URL.
2. Reuse it when the tab is still open, the transport is alive, no transfer is
   pending, and the session is within its idle lifetime.
3. Otherwise discard it and fall back to the existing `window.open` path.

`bridge.destroy()` destroys every session transport. It does not close receiver
tabs; the receiving application remains the user's working tab, as it does
today.

### Session registry

The bridge holds one in-memory registry per instance:

```ts
interface SenderSession {
  target: URL;
  window: Window;
  transport: Transport<ReceiverWire>;
  protocolVersion: number;
  createdAt: number;
  lastUsedAt: number;
  pending: boolean;
}
```

- Key: the normalized destination URL. Fragment components that belong to the
  receiving application's routing are part of the key; the tabEE invite
  parameters are not.
- `pending` prevents concurrent offers on one transport. A second send while
  busy rejects with `TRANSFER_STATE_INVALID` rather than queuing.
- A method-level timeout or transport error discards the session and falls back
  to a new window.

### Receiver lifecycle

The receiver already keeps its transport until `destroy()`. Formalize that:

- a session may accept more than one sequential offer while it is alive;
- each offer still carries fresh `offerId` and `transferId` values and is
  consented to independently;
- implementation limits: one pending offer, an idle timeout (proposal:
  30 minutes), and an offer cap per session (proposal: 16), after which the
  receiver tears the transport down;
- navigation or `destroy()` ends the session.

### Protocol

No new wire operations are required. The existing sequence repeats:

```text
sender                                      receiver
offer(offerId, transferId, dataset)    →    validate, consent
accept({offerId})                      ←
transfer({transferId, files})          →
Receipt                                ←
```

The protocol specification should state explicitly that a transport may carry
multiple sequential offers and that `offerId` / `transferId` are unique per
offer within a session.

### Security

Reuse adds lifetime, not trust:

- origin pinning is unchanged; the session keeps the origin verified during the
  bootstrap;
- consent is never cached — every offer shows the dataset, files, sizes, and
  verified origin;
- sessions are held in memory only; no tab reference or transport survives a
  sender reload;
- idle expiry limits the window in which a stale channel exists;
- only tabs the sender opened can be referenced; user tabs remain out of reach;
- COOP and other opener-severing policies behave exactly as they do today.

## Failure modes

| Condition | Behaviour |
| --- | --- |
| No live session | Open a new tab as today. |
| Tab closed | Drop the session, open a new tab. |
| Receiver called `destroy()` or navigated | Transport fails or times out; drop the session and open a new tab. |
| Transfer already pending | Reject `TRANSFER_STATE_INVALID`; do not queue. |
| Idle timeout or offer cap reached | Drop the session, open a new tab. |
| Protocol version changed | Establish a new session. |
| COOP severs the opener | Handshake fails as today; no reuse is possible. |

## Alternatives considered

1. **Stable named window only.** Reuses the tab but reloads the receiver and
   loses state; rejected as a standalone solution.
2. **BroadcastChannel / localStorage handshake.** Same-origin only; cannot
   serve cross-origin transfers.
3. **Service worker or shared worker discovery.** Origin-scoped; same problem.
4. **Browser extension / DevTools tab targeting.** Outside the web platform and
   not deployable to normal users.

## Testing plan

Unit:

- session key normalization and lookup;
- idle expiry, offer cap, pending-transfer rejection;
- fallback when `window.closed` or the transport is dead;
- `destroy()` tears down every transport without closing tabs.

End-to-end:

- two sequential sends to the same receiver use one tab;
- the second transfer preserves receiver state from the first;
- closing the receiver between sends opens a new tab;
- declining an offer leaves the session reusable;
- `reuse: false` keeps the current tab-per-send behaviour;
- existing non-reuse tests continue to pass unchanged.

## Open questions

- Should `reuse` default to `true` after a stabilisation period?
- Exact idle timeout and per-session offer cap.
- Session key: full destination URL versus origin plus path.
- Should a receiver be able to opt out of reuse, or restrict it per origin?
- Should `destroy()` close receiver tabs, or only tear down transports?

## Rollout

1. Land the sender registry and receiver lifecycle guarantees behind
   `reuse: true` (opt-in), with tests.
2. Update the examples and README to demonstrate a second send into the same
   receiver tab.
3. After a release without regressions, consider making reuse the default.
