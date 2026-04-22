import { Bid, Agent } from '@/types';

/**
 * Calculates a deterministic score for a bid based on the SwarmPay PRD formula.
 * 
 * Formula: score = (1/price) * reputation * (1/estimatedTime)
 * 
 * Note: Lower price, higher reputation, and faster time increase the score.
 */
export function calculateBidScore(bid: Bid, agent: Agent): number {
  if (!agent) {
    throw new Error('Agent is required for scoring');
  }

  // Explicit Guards for zero or negative values
  if (bid.price <= 0) {
    throw new Error(`Invalid bid price: ${bid.price}. Price must be positive.`);
  }
  if (agent.reputation <= 0) {
    // We treat reputation <= 0 as a minimum score floor to prevent division/multiplication issues
    // but in a strict economic context, we normalize to a baseline.
    return 0; 
  }
  if (bid.estimatedTimeMs <= 0) {
    throw new Error(`Invalid estimated time: ${bid.estimatedTimeMs}. Time must be positive.`);
  }

  // Normalization for scoring stability
  const price = bid.price;
  const confidence = bid.confidence || (agent.reputation / 100);
  const timeSec = bid.estimatedTimeMs / 1000;

  // score = confidence / (price * timeInSeconds)
  // Higher confidence, lower price, and faster time increase the score.
  const score = confidence / (price * timeSec);

  return score;
}
