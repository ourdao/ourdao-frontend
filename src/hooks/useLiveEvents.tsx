"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_REFRESH_INTERVAL_MS } from "@/constants";
import { openEventStream, type StreamStatus } from "@/lib/event-stream";
import { handleLiveEvent, refreshStreamQueries } from "@/lib/live-events";

const StreamStatusContext = createContext<StreamStatus>("offline");

function useLiveEvents() {
  const client = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>("offline");

  useEffect(() => {
    let connected = false;
    return openEventStream({
      onEvent: (event) => handleLiveEvent(client, event),
      onStatus: (status) => {
        if (status === "connected" && !connected) {
          // Cover changes between the first page reads and the subscription.
          connected = true;
          refreshStreamQueries(client);
        }
        setStatus(status);
      },
    });
  }, [client]);

  return status;
}

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const status = useLiveEvents();
  return <StreamStatusContext.Provider value={status}>{children}</StreamStatusContext.Provider>;
}

export function useStreamStatus() {
  return useContext(StreamStatusContext);
}

export function useStreamPolling(enabled: boolean) {
  const status = useStreamStatus();
  return enabled && status !== "connected" ? QUERY_REFRESH_INTERVAL_MS : false;
}
