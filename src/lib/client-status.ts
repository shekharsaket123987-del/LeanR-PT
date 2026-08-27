/** Client-safe half of the client-status model -- the type, display labels,
 * and pure derivation function, importable from both server code and "use
 * client" components. The DB-backed half (getClientStatusSnapshot,
 * logClientStatusChange) lives in @/lib/services/clientStatus.ts instead,
 * since it pulls in supabaseAdmin (guarded by "server-only") and would break
 * the client bundle if merged into this file. */

/** Six buckets, in priority order (a client can only ever be one at a time):
 * - paused: a subscription is currently on pause (subscriptions.status).
 * - active: a subscription is currently running.
 * - created: a subscription was purchased but the client hasn't picked/
 *   reached their start date yet (subscriptions.status = 'awaiting_activation').
 * - expired: has had at least one subscription, none of them are
 *   active/paused/awaiting right now.
 * - demo: never purchased anything, but has a demo (session_type =
 *   'assessment') booking on record.
 * - not_paid: signed up, no subscription ever, no demo taken either. */
export type ClientStatus = "not_paid" | "demo" | "created" | "active" | "paused" | "expired";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  not_paid: "Not Paid",
  demo: "Demo",
  created: "Created",
  active: "Active",
  paused: "Paused",
  expired: "Expired",
};

/** Pure function so it can be unit-tested and reused against whatever shape
 * of data each caller already has on hand (listClients' merged rows, a
 * freshly-fetched subscriptions array, etc). subscriptionStatuses is every
 * subscription row's status the client has ever had, in any order. */
export function deriveClientStatus(subscriptionStatuses: string[], hasDemo: boolean): ClientStatus {
  if (subscriptionStatuses.includes("paused")) return "paused";
  if (subscriptionStatuses.includes("active")) return "active";
  if (subscriptionStatuses.includes("awaiting_activation")) return "created";
  if (subscriptionStatuses.length > 0) return "expired";
  if (hasDemo) return "demo";
  return "not_paid";
}
