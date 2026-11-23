import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBackendConfigured } from "@/lib/backend-config";
import { openEventStream } from "@/lib/event-stream";
import { logger } from "@/lib/logger";

vi.mock("@/lib/backend-config", () => ({
  BACKEND_URL: "https://backend.example/",
  isBackendConfigured: vi.fn(() => true),
}));

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  close = vi.fn();

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

describe("openEventStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.mocked(isBackendConfigured).mockReturnValue(true);
    FakeEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens one configured stream and decodes its named events", () => {
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const close = openEventStream({ onEvent, onStatus });
    expect(FakeEventSource.instances).toHaveLength(1);
    const [source] = FakeEventSource.instances;
    expect(source.url).toBe("https://backend.example/api/stream");
    source.dispatchEvent(new Event("open"));

    const messages = [
      { type: "heartbeat", timestamp: 1 },
      { type: "notification", channel: "members_changed", payload: { ledger: 10 }, timestamp: 2 },
      { type: "resync", payload: { missed: false }, timestamp: 3 },
      { type: "error", payload: { message: "Stream interrupted" }, timestamp: 4 },
    ];
    for (const message of messages) source.emit(message.type, message);

    expect(onEvent.mock.calls).toEqual(messages.map((message) => [message]));
    expect(onStatus.mock.calls).toEqual([["reconnecting"], ["connected"], ["reconnecting"]]);
    expect(source.close).toHaveBeenCalledOnce();
    close();
  });

  it("backs off repeated failures and requests a full refresh when the replacement opens", () => {
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const close = openEventStream({ onEvent, onStatus });
    FakeEventSource.instances[0].dispatchEvent(new Event("open"));

    for (const [index, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
      const source = FakeEventSource.instances[index];
      source.dispatchEvent(new Event("error"));
      source.dispatchEvent(new Event("error"));
      expect(source.close).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(delay - 1);
      expect(FakeEventSource.instances).toHaveLength(index + 1);
      vi.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(index + 2);
    }

    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    expect(onEvent).not.toHaveBeenCalled();
    const recovered = FakeEventSource.instances.at(-1)!;
    recovered.dispatchEvent(new Event("open"));
    expect(onStatus).toHaveBeenLastCalledWith("connected");
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({
      type: "resync",
      payload: { missed: true },
      timestamp: Date.now(),
    });

    recovered.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(999);
    expect(FakeEventSource.instances).toHaveLength(8);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(9);
    close();
  });

  it("treats a backend disconnect as a drop and cancels retry on cleanup", () => {
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const close = openEventStream({ onEvent, onStatus });
    const [source] = FakeEventSource.instances;
    source.dispatchEvent(new Event("open"));
    source.emit("notification", {
      type: "notification",
      channel: "members_changed",
      payload: { type: "disconnect" },
      timestamp: 1,
    });

    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    expect(onEvent).not.toHaveBeenCalled();
    close();
    close();
    vi.runAllTimers();
    source.dispatchEvent(new Event("open"));
    expect(FakeEventSource.instances).toEqual([source]);
    expect(source.close).toHaveBeenCalledOnce();
    expect(onStatus).toHaveBeenLastCalledWith("offline");
  });

  it("ignores malformed events without logging their content", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const onEvent = vi.fn();
    const close = openEventStream({ onEvent, onStatus: vi.fn() });
    const [source] = FakeEventSource.instances;
    source.dispatchEvent(new MessageEvent("notification", { data: "malformed data" }));
    source.emit("notification", { type: "heartbeat", timestamp: 1 });
    source.emit("resync", { type: "resync", payload: { missed: "true" }, timestamp: 1 });

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      ["Ignoring malformed DAO stream event", { type: "notification" }],
      ["Ignoring malformed DAO stream event", { type: "notification" }],
      ["Ignoring malformed DAO stream event", { type: "resync" }],
    ]);
    close();
    expect(source.close).toHaveBeenCalledOnce();
  });

  it("stays offline when no backend or browser transport is available", () => {
    const onStatus = vi.fn();
    const onEvent = vi.fn();
    vi.mocked(isBackendConfigured).mockReturnValue(false);
    openEventStream({ onEvent, onStatus })();

    vi.mocked(isBackendConfigured).mockReturnValue(true);
    vi.stubGlobal("EventSource", undefined);
    openEventStream({ onEvent, onStatus })();

    expect(onStatus.mock.calls).toEqual([["offline"], ["offline"]]);
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
