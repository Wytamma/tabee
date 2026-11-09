import { connect, WindowMessenger, type Methods, type RemoteProxy } from "penpal";
import { TabeeException } from "@tabee/protocol";
import { toTransportError } from "./result.js";

export interface Transport<TMethods extends Methods> {
  remote: RemoteProxy<TMethods>;
  destroy(): void;
}

/**
 * Exact-origin Penpal connection. `allowedOrigins` is always the origin that
 * tabEE verified from the raw handshake; a wildcard is never permitted here.
 */
export async function openTransport<TMethods extends Methods>(options: {
  remoteWindow: Window;
  allowedOrigin: string;
  channel: string;
  timeoutMs: number;
  methods: Methods;
}): Promise<Transport<TMethods>> {
  const messenger = new WindowMessenger({
    remoteWindow: options.remoteWindow,
    allowedOrigins: [options.allowedOrigin],
  });

  const connection = connect<TMethods>({
    messenger,
    methods: options.methods,
    timeout: options.timeoutMs,
    channel: options.channel,
  });

  try {
    const remote = await connection.promise;
    return { remote, destroy: () => connection.destroy() };
  } catch (error) {
    connection.destroy();
    throw new TabeeException(toTransportError(error, "Could not establish the tabEE session"));
  }
}
