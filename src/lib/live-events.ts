import { matchQuery, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { StreamMessage } from "./event-stream";
import { queryKeys, queryKeyPrefixes as prefix } from "./query-keys";

// Mirrors the DAO-wide channels exported by ourdao-backend/src/api/stream.ts.
export const STREAM_CHANNELS = [
  "members_changed",
  "loan_proposals_changed",
  "loans_changed",
  "treasury_proposals_changed",
  "interest_changed",
  "documents_changed",
] as const;

type StreamChannel = (typeof STREAM_CHANNELS)[number];

const activityKeys = [queryKeys.daoEvents(), prefix.activity];
const proposalCounts = [queryKeys.backendStats(), queryKeys.daoStatsBackend()];

export const streamQueryKeys = {
  members_changed: [
    prefix.members,
    prefix.memberSummary,
    prefix.memberActivity,
    prefix.userData,
    prefix.stake,
    prefix.loanEligibility,
    queryKeys.daoStats(),
    queryKeys.daoStatsBackend(),
    ...activityKeys,
  ],
  loan_proposals_changed: [
    ...proposalCounts,
    queryKeys.loanProposalsAll(),
    prefix.loanProposal,
    prefix.hasVoted("Loan"),
    prefix.loanTimeline,
    ...activityKeys,
  ],
  loans_changed: [
    queryKeys.daoStats(),
    queryKeys.daoStatsBackend(),
    prefix.loan,
    prefix.userLoans,
    prefix.userData,
    prefix.loanTimeline,
    prefix.members,
    prefix.memberSummary,
    prefix.memberActivity,
    prefix.loanEligibility,
    ...activityKeys,
  ],
  treasury_proposals_changed: [
    ...proposalCounts,
    queryKeys.daoStats(),
    queryKeys.treasuryProposalsAll(),
    prefix.treasuryProposal,
    prefix.hasVoted("Treasury"),
    prefix.treasuryTimeline,
    ...activityKeys,
  ],
  interest_changed: [
    prefix.interestDistributions,
    queryKeys.daoStatsBackend(),
    prefix.userData,
    prefix.memberSummary,
    prefix.memberActivity,
    ...activityKeys,
  ],
  documents_changed: [
    prefix.documentHistory,
    prefix.proposalDocument("Loan"),
    prefix.proposalDocument("Treasury"),
    prefix.loanTimeline,
    prefix.treasuryTimeline,
    ...activityKeys,
  ],
} satisfies Record<StreamChannel, QueryKey[]>;

const streamKeys = Object.values(streamQueryKeys).flat();

// Cache entries backed by endpoints that also change independently of stream notifications.
const resyncKeys = [...streamKeys, prefix.adminLog, queryKeys.failedEvents(), prefix.notifications];

function invalidate(client: QueryClient, keys: QueryKey[]) {
  const matches = (query: Query) => keys.some((queryKey) => matchQuery({ queryKey }, query));
  // TanStack deduplicates an in-flight first fetch. Cancel it so its pre-event
  // response cannot become the only result once the stream turns polling off.
  void client.cancelQueries({
    type: "active",
    fetchStatus: "fetching",
    predicate: (query) => query.state.data === undefined && matches(query),
  });
  void client.invalidateQueries({ predicate: matches });
}

export function refreshStreamQueries(client: QueryClient) {
  invalidate(client, streamKeys);
}

export function handleLiveEvent(client: QueryClient, event: StreamMessage) {
  let keys: QueryKey[];
  if (event.type === "resync" && event.payload?.missed === true) {
    keys = resyncKeys;
  } else if (
    event.type === "notification" &&
    event.channel &&
    Object.hasOwn(streamQueryKeys, event.channel)
  ) {
    keys = streamQueryKeys[event.channel as StreamChannel];
  } else {
    return;
  }

  invalidate(client, keys);
}
