import { z } from "zod";
import { BACKEND_URL, isBackendConfigured } from "./backend-config";
import { logger } from "./logger";

const EVENT_TYPES = ["heartbeat", "notification", "error", "resync"] as const;
const messageSchema = z.object({
  type: z.enum(EVENT_TYPES),
  channel: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number(),
});

const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export type StreamMessage = z.infer<typeof messageSchema>;
export type StreamStatus = "offline" | "reconnecting" | "connected";

export function openEventStream({
  onEvent,
  onStatus,
}: {
  onEvent: (message: StreamMessage) => void;
  onStatus: (status: StreamStatus) => void;
}): () => void {
  if (!isBackendConfigured() || typeof EventSource !== "function") {
    onStatus("offline");
    return () => {};
  }

  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let delay = INITIAL_DELAY_MS;
  let status: StreamStatus | undefined;
  let missed = false;
  let closed = false;

  function updateStatus(next: StreamStatus) {
    if (status === next) return;
    status = next;
    onStatus(next);
  }

  function connect() {
    updateStatus("reconnecting");
    let current: EventSource;
    try {
      current = new EventSource(`${BACKEND_URL.replace(/\/+$/, "")}/api/stream`);
    } catch {
      logger.warn("Could not open the DAO event stream");
      updateStatus("offline");
      return;
    }
    source = current;

    function disconnect() {
      source = null;
      current.close();
      missed = true;
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
      updateStatus("reconnecting");
    }

    current.addEventListener("open", () => {
      if (source !== current) return;
      delay = INITIAL_DELAY_MS;
      updateStatus("connected");
      if (missed) {
        // A replacement EventSource cannot carry the previous Last-Event-ID.
        missed = false;
        onEvent({ type: "resync", payload: { missed: true }, timestamp: Date.now() });
      }
    });

    for (const type of EVENT_TYPES) {
      current.addEventListener(type, (event) => {
        if (source !== current) return;
        if (type === "error" && !("data" in event)) {
          disconnect();
          return;
        }

        const message = parseMessage(event, type);
        if (!message) {
          logger.warn("Ignoring malformed DAO stream event", { type });
          return;
        }
        if (message.type === "notification" && message.payload?.type === "disconnect") {
          disconnect();
          return;
        }
        if (message.type === "error") disconnect();
        onEvent(message);
      });
    }
  }

  connect();
  return () => {
    if (closed) return;
    closed = true;
    clearTimeout(retry);
    const current = source;
    source = null;
    current?.close();
    updateStatus("offline");
  };
}

function parseMessage(event: Event, type: StreamMessage["type"]): StreamMessage | null {
  if (!("data" in event) || typeof event.data !== "string") return null;
  try {
    const message = messageSchema.safeParse(JSON.parse(event.data));
    if (!message.success || message.data.type !== type) return null;
    if (type === "resync" && typeof message.data.payload?.missed !== "boolean") return null;
    return message.data;
  } catch {
    return null;
  }
}
