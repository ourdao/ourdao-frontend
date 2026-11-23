import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { handleLiveEvent, STREAM_CHANNELS, streamQueryKeys } from "@/lib/live-events";
import { queryKeys } from "@/lib/query-keys";

const channelCases = [
  ["members_changed", [queryKeys.members(10), queryKeys.members(50), queryKeys.userData("member")]],
  [
    "loan_proposals_changed",
    [queryKeys.loanProposals(10), queryKeys.loanProposal(5), queryKeys.backendStats()],
  ],
  [
    "loans_changed",
    [
      queryKeys.loan(5),
      queryKeys.userLoans("member"),
      queryKeys.userData("member"),
      queryKeys.loanTimeline(5),
      queryKeys.members(50),
      queryKeys.daoStats(),
    ],
  ],
  [
    "treasury_proposals_changed",
    [queryKeys.treasuryProposals(10), queryKeys.treasuryProposal(5), queryKeys.backendStats()],
  ],
  ["interest_changed", [queryKeys.interestDistributions(), queryKeys.interestDistributions(20)]],
  [
    "documents_changed",
    [queryKeys.documentHistory("loan", 5), queryKeys.proposalDocument("Loan", 5)],
  ],
] satisfies [string, QueryKey[]][];

describe("live event invalidation", () => {
  it("maps every public channel", () => {
    expect(Object.keys(streamQueryKeys).sort()).toEqual([...STREAM_CHANNELS].sort());
    expect(channelCases.map(([channel]) => channel).sort()).toEqual([...STREAM_CHANNELS].sort());
  });

  it.each(channelCases)("%s invalidates the relevant query prefixes only", (channel, keys) => {
    const client = new QueryClient();
    const privateKey = queryKeys.notifications("member");
    const unrelatedKey = queryKeys.loanPolicy();
    const documentContent = queryKeys.document("ipfs-cid", "member");
    for (const key of [...keys, privateKey, unrelatedKey, documentContent])
      client.setQueryData(key, []);
    handleLiveEvent(client, { type: "notification", channel, timestamp: 1 });
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(privateKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(documentContent)?.isInvalidated).toBe(false);
  });

  it("ignores heartbeats, unknown channels, and resync without a missed gap", () => {
    const client = new QueryClient();
    const key = queryKeys.members(50);
    client.setQueryData(key, []);
    handleLiveEvent(client, { type: "heartbeat", timestamp: 1 });
    handleLiveEvent(client, { type: "notification", channel: "future_channel", timestamp: 2 });
    handleLiveEvent(client, { type: "notification", channel: "constructor", timestamp: 3 });
    handleLiveEvent(client, { type: "resync", payload: { missed: false }, timestamp: 4 });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("refetches active observers even if their first request is still pending", async () => {
    const client = new QueryClient();
    const laterData = ["fresh member record"];
    const oldRequestAborted = vi.fn();
    const request = vi
      .fn()
      .mockImplementationOnce(
        ({ signal }) =>
          new Promise((_, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                oldRequestAborted();
                reject(signal.reason);
              },
              { once: true }
            );
          })
      )
      .mockResolvedValueOnce(laterData);
    const key = queryKeys.members(20);
    const subscription = new QueryObserver(client, { queryKey: key, queryFn: request }).subscribe(
      () => {}
    );
    try {
      handleLiveEvent(client, { type: "notification", channel: "loans_changed", timestamp: 1 });
      expect(oldRequestAborted).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(client.getQueryData(key)).toEqual(laterData));
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      subscription();
      client.clear();
    }
  });

  it("marks all backend-derived queries stale after a missed resync", () => {
    const client = new QueryClient();
    const keys = [
      queryKeys.backendStats(),
      queryKeys.daoStatsBackend(),
      queryKeys.userLoans("member"),
      queryKeys.daoEvents(),
      queryKeys.activity(10),
      queryKeys.adminLog(10),
      queryKeys.failedEvents(),
      queryKeys.documentHistory("loan", 1),
      queryKeys.loanTimeline(1),
      queryKeys.treasuryTimeline(1),
      queryKeys.memberSummary("member"),
      queryKeys.memberActivity("member", 10),
      queryKeys.members(10),
      queryKeys.interestDistributions(30),
      queryKeys.notifications("member"),
    ];
    for (const key of keys) client.setQueryData(key, []);
    handleLiveEvent(client, { type: "resync", payload: { missed: true }, timestamp: 1 });
    for (const key of keys)
      expect(client.getQueryState(key)?.isInvalidated, key.join("/")).toBe(true);
  });
});
