import { Bid, Agent } from '@/types';

/**
 * Bid score: higher is better. Reputation-weighted to enforce economic
 * alignment — well-performing agents win more bids.
 *
 *   score = (1 / price) × (reputation / 100) × confidence × (1 / estimatedTimeMs)
 *
 * Returns -Infinity (rather than throwing) on degenerate inputs so the
 * caller can rank bids without crashing the pipeline.
 */
export function calculateBidScore(bid: Bid, agent: Agent): number {
  if (!agent) return -Infinity
  const price = bid.price
  if (!Number.isFinite(price) || price <= 0) return -Infinity

  const time = bid.estimatedTimeMs
  if (!Number.isFinite(time) || time <= 0) return -Infinity

  const reputation = agent.reputation ?? 0
  if (reputation <= 0) return 0

  const confidence = bid.confidence ?? (reputation / 100)

  return (1 / price) * (reputation / 100) * confidence * (1 / time)
}
