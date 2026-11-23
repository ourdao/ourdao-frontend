// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QUERY_REFRESH_INTERVAL_MS as interval } from "@/constants";
import { useInterestDistributions, useMembers } from "@/hooks/dao/reads";
import { useLoanProposals, useTreasuryProposals } from "@/hooks/dao/proposal-reads";
import { useAutoNotifications } from "@/hooks/useNotifications";
import { LiveEventsProvider } from "@/hooks/useLiveEvents";
import { backend } from "@/lib/backend";
import { openEventStream } from "@/lib/event-stream";

vi.mock("@/lib/event-stream", () => ({ openEventStream: vi.fn() }));
vi.mock("@/lib/wallet", () => ({ useWallet: () => ({ address: "member" }) }));
vi.mock("@/lib/backend", () => ({
  backend: {
    getMembers: vi.fn().mockResolvedValue([]),
    getInterestDistributions: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({}),
    getNotifications: vi.fn().mockResolvedValue([]),
  },
}));

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("pauses covered polling when live, still refetches on stream events, and resumes on disconnect", async () => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  const client = new QueryClient();
  const close = vi.fn();
  vi.mocked(openEventStream).mockReturnValue(close);

  const { unmount } = renderHook(
    () => {
      useMembers();
      useInterestDistributions();
      useLoanProposals();
      useTreasuryProposals();
      useAutoNotifications();
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          <LiveEventsProvider>{children}</LiveEventsProvider>
        </QueryClientProvider>
      ),
    }
  );

  expect(openEventStream).toHaveBeenCalledTimes(1);
  const stream = vi.mocked(openEventStream).mock.calls[0][0];
  const covered = [backend.getMembers, backend.getInterestDistributions, backend.getStats];
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    stream.onStatus("connected");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(interval);
  });
  for (const request of covered) expect(request).toHaveBeenCalledTimes(2);
  expect(backend.getNotifications).toHaveBeenCalledTimes(2);

  await act(async () => {
    stream.onEvent({ type: "notification", channel: "members_changed", timestamp: 1 });
  });
  expect(backend.getMembers).toHaveBeenCalledTimes(3);
  await act(async () => {
    stream.onEvent({ type: "resync", payload: { missed: true }, timestamp: 2 });
  });
  expect(backend.getMembers).toHaveBeenCalledTimes(4);
  expect(backend.getInterestDistributions).toHaveBeenCalledTimes(3);
  expect(backend.getStats).toHaveBeenCalledTimes(3);
  expect(backend.getNotifications).toHaveBeenCalledTimes(3);

  await act(async () => {
    stream.onStatus("reconnecting");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(interval);
  });
  expect(backend.getMembers).toHaveBeenCalledTimes(5);
  expect(backend.getInterestDistributions).toHaveBeenCalledTimes(4);
  expect(backend.getStats).toHaveBeenCalledTimes(4);
  expect(backend.getNotifications).toHaveBeenCalledTimes(4);
  unmount();
  expect(close).toHaveBeenCalledTimes(1);
  client.clear();
});
