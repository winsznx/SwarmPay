/**
 * ERC-8004 — Trustless AI Agent Identity on Arc Testnet
 *
 * Live contracts (CREATE2 vanity addresses, same on all supported chains):
 *   Identity Registry   : 0x8004A818BFB912233c491871b3d84c89A494BD9e
 *   Reputation Registry : 0x8004B663056A597Dffe9eCcC1965A193B7388713
 *   Validation Registry : 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
 *
 * Chain: Arc Testnet (chain ID 5042002)
 *   RPC: https://rpc.testnet.arc.network
 *   Explorer: https://testnet.arcscan.app
 *   Gas token: USDC (NOT ETH — fund platform wallet with USDC from faucet.circle.com)
 *
 * Architecture:
 *   Everything — identity, reputation, AND payments — runs on Arc testnet.
 *   No Ethereum Sepolia dependency. ARC_RPC_URL serves both ERC-8004 and settlement.
 *
 * Wallet separation (required by ERC-8004 anti-self-dealing rule):
 *   PLATFORM_PRIVATE_KEY  — owner EOA: registers agents (mints NFTs), binds wallets.
 *   VALIDATOR_PRIVATE_KEY — validator EOA: calls giveFeedback(). MUST differ from owner.
 *     If VALIDATOR_PRIVATE_KEY is unset, reputation submission is skipped (not an error).
 *
 * Judge verification (no trust required):
 *   cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
 *     "getAgentWallet(uint256)(address)" <tokenId> \
 *     --rpc-url https://rpc.testnet.arc.network
 */

import { ethers } from 'ethers'
import { getCircleClient, getAgentWallets } from './circleWallets'
import { supabaseAdmin } from './supabase'

// ── Contract addresses ────────────────────────────────────────────────────────

const IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY_REGISTRY
  ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e'

const REPUTATION_REGISTRY = process.env.ERC8004_REPUTATION_REGISTRY
  ?? '0x8004B663056A597Dffe9eCcC1965A193B7388713'

const VALIDATION_REGISTRY = process.env.ERC8004_VALIDATION_REGISTRY
  ?? '0x8004Cb1BF31DAf7788923b405b754f57acEB4272'

const IDENTITY_CHAIN_ID = parseInt(process.env.ERC8004_CHAIN_ID ?? '5042002', 10) // Arc testnet

// ── ABIs (minimal — only functions we call) ───────────────────────────────────

const IDENTITY_ABI = [
  'function register(string agentURI) returns (uint256 agentId)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
]

const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
  'function getClients(uint256 agentId) view returns (address[])',
  'function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)',
]

// ── Provider / signer ─────────────────────────────────────────────────────────

function getIdentityProvider(): ethers.JsonRpcProvider | null {
  const rpc = process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network'
  return new ethers.JsonRpcProvider(rpc, IDENTITY_CHAIN_ID)
}

/**
 * Returns an ethers Wallet connected to Arc testnet using PLATFORM_PRIVATE_KEY.
 * This EOA is the owner of all SwarmPay agent NFTs in the ERC-8004 registry.
 * Gas on Arc is paid in USDC — fund this wallet at https://faucet.circle.com
 */
function getPlatformSigner(): ethers.Wallet | null {
  const key = process.env.PLATFORM_PRIVATE_KEY
  if (!key) return null
  return new ethers.Wallet(key, getIdentityProvider())
}

/**
 * Returns an ethers Wallet for the validator EOA (VALIDATOR_PRIVATE_KEY).
 * ERC-8004 blocks the owner from calling giveFeedback() on their own agents.
 * This separate signer satisfies the anti-self-dealing rule.
 * Returns null if VALIDATOR_PRIVATE_KEY is unset — callers skip on-chain rep.
 */
function getValidatorSigner(): ethers.Wallet | null {
  const key = process.env.VALIDATOR_PRIVATE_KEY
  if (!key) return null
  return new ethers.Wallet(key, getIdentityProvider())
}

// ── EIP-712 typed data for setAgentWallet ─────────────────────────────────────
// From contract source:
//   AGENT_WALLET_SET_TYPEHASH = keccak256(
//     "AgentWalletSet(uint256 agentId,address newWallet,address owner,uint256 deadline)"
//   )
//   Domain: name="ERC8004IdentityRegistry", version="1"

function buildSetAgentWalletTypedData(
  agentId: bigint,
  newWallet: string,
  ownerAddress: string,
  deadline: number
) {
  return {
    domain: {
      name: 'ERC8004IdentityRegistry',
      version: '1',
      chainId: IDENTITY_CHAIN_ID,
      verifyingContract: IDENTITY_REGISTRY,
    },
    types: {
      // Circle's signTypedData API requires EIP712Domain to be present in types
      EIP712Domain: [
        { name: 'name',              type: 'string'  },
        { name: 'version',           type: 'string'  },
        { name: 'chainId',           type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      AgentWalletSet: [
        { name: 'agentId',   type: 'uint256' },
        { name: 'newWallet', type: 'address' },
        { name: 'owner',     type: 'address' },
        { name: 'deadline',  type: 'uint256' },
      ],
    },
    primaryType: 'AgentWalletSet' as const,
    message: {
      agentId:   agentId.toString(),
      newWallet,
      owner:     ownerAddress,
      deadline:  deadline.toString(),
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AgentRegistration {
  swarmAgentId: string   // e.g. 'crypto-scout-x'
  erc8004TokenId: bigint // uint256 in the registry
  walletAddress: string  // Circle wallet 0x address
  txHash: string         // registration transaction hash on Arc testnet
}

/**
 * Register a SwarmPay agent in the ERC-8004 Identity Registry on Arc testnet.
 *
 * Emits: Registered(agentId, agentURI, owner)
 *
 * The agentURI points to a JSON metadata object stored on IPFS or inline.
 * Per the ERC-8004 spec, the metadata must include: name, description,
 * services[], x402Support, active, supportedTrust[].
 *
 * After registration, call bindAgentWallet() to associate the Circle wallet.
 */
export async function registerAgent(
  swarmAgentId: string,
  agentURI: string
): Promise<{ tokenId: bigint; txHash: string } | null> {
  const signer = getPlatformSigner()
  if (!signer) {
    console.warn('[ERC8004] PLATFORM_PRIVATE_KEY not set — cannot register')
    return null
  }

  const registry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, signer)

  try {
    const tx = await registry.register(agentURI)
    const receipt = await tx.wait()

    // Parse the Registered(agentId, agentURI, owner) event
    const iface = new ethers.Interface([
      'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)'
    ])
    const registeredLog = receipt.logs
      .map((log: any) => { try { return iface.parseLog(log) } catch { return null } })
      .find((e: any) => e?.name === 'Registered')

    if (!registeredLog) {
      console.error('[ERC8004] Registered event not found in receipt')
      return null
    }

    const tokenId: bigint = registeredLog.args.agentId

    // Persist in Supabase for fast lookup (the registry is authoritative,
    // this is a cache that survives cold starts)
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('agents')
        .update({ erc8004_token_id: tokenId.toString() })
        .eq('id', swarmAgentId)
    }

    console.log(`[ERC8004] Registered ${swarmAgentId} → tokenId=${tokenId} tx=${receipt.hash}`)
    return { tokenId, txHash: receipt.hash }
  } catch (e) {
    console.error('[ERC8004] register() failed:', e)
    return null
  }
}

/**
 * Bind an agent's Circle developer-controlled wallet to their ERC-8004 identity.
 *
 * Flow:
 *   1. Construct EIP-712 AgentWalletSet typed data (agentId, circleAddr, platformAddr, deadline)
 *   2. Circle wallet (newWallet) signs the typed data via Circle's signTypedData API
 *      — the contract verifies the signature matches newWallet, proving wallet consent
 *   3. Platform EOA submits setAgentWallet(tokenId, circleAddr, deadline, signature) on Arc testnet
 *
 * After this call, anyone can verify: registry.getAgentWallet(tokenId) === circleWalletAddress
 * This is the cryptographic binding between off-chain agent ID and on-chain identity.
 */
export async function bindAgentWallet(
  erc8004TokenId: bigint,
  circleWalletId: string,
  circleWalletAddress: string
): Promise<string | null> {
  const signer = getPlatformSigner()
  const circle = getCircleClient()
  if (!signer || !circle) return null

  const ownerAddress = await signer.getAddress()
  const deadline = Math.floor(Date.now() / 1000) + 270 // 4.5 min

  const typedData = buildSetAgentWalletTypedData(
    erc8004TokenId,
    circleWalletAddress,
    ownerAddress,
    deadline
  )

  // Circle wallet (newWallet) must sign — ERC-8004 contract verifies sig against newWallet address,
  // proving the wallet consents to being bound. Circle holds the MPC key, we call their API.
  let signature: string
  try {
    const res = await (circle as any).signTypedData({
      walletId: circleWalletId,
      data: JSON.stringify(typedData),
    })
    signature = res?.data?.signature
    if (!signature) throw new Error('empty signature from Circle signTypedData')
    console.log(`[ERC8004] Circle signed typed data for ${circleWalletId}: sig=${signature.slice(0, 20)}...`)
  } catch (e) {
    console.error('[ERC8004] Circle signTypedData failed:', e)
    return null
  }

  const registry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, signer)
  try {
    const tx = await registry.setAgentWallet(
      erc8004TokenId,
      circleWalletAddress,
      deadline,
      signature
    )
    const receipt = await tx.wait()
    console.log(`[ERC8004] Wallet bound: tokenId=${erc8004TokenId} → ${circleWalletAddress} tx=${receipt.hash}`)

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('agents')
        .update({
          wallet_address: circleWalletAddress,
          erc8004_bind_tx: receipt.hash
        })
        .eq('erc8004_token_id', erc8004TokenId.toString())
    }

    return receipt.hash as string
  } catch (e) {
    console.error('[ERC8004] setAgentWallet() failed:', e)
    return null
  }
}

/**
 * Read the Circle wallet address bound to an ERC-8004 identity token.
 * This is the on-chain source of truth — no database involved.
 *
 * Any external party can reproduce this call:
 *   cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
 *     "getAgentWallet(uint256)(address)" <tokenId> --rpc-url https://rpc.testnet.arc.network
 */
export async function getOnChainWalletAddress(erc8004TokenId: bigint): Promise<string | null> {
  const provider = getIdentityProvider()
  if (!provider) return null
  const registry = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, provider)
  try {
    const addr: string = await registry.getAgentWallet(erc8004TokenId)
    return addr === ethers.ZeroAddress ? null : addr
  } catch (e) {
    console.error('[ERC8004] getAgentWallet() failed:', e)
    return null
  }
}

/**
 * Verify that a payment signer matches the on-chain ERC-8004 identity.
 * Used in verifyPaymentIntent() as the authoritative identity check.
 *
 * Returns true only if:
 *   1. We can look up the agent's ERC-8004 tokenId
 *   2. The on-chain getAgentWallet(tokenId) matches the claimed signer address
 *
 * This closes the "trust our database" gap: verification reads from Arc testnet,
 * not from our Supabase.
 */
export async function verifyAgentIdentityOnChain(
  swarmAgentId: string,
  claimedSignerAddress: string
): Promise<boolean> {
  const tokenId = await getAgentTokenId(swarmAgentId)
  if (tokenId == null) {
    console.warn(`[ERC8004] No tokenId for ${swarmAgentId} — cannot verify on-chain`)
    return false
  }

  const onChainAddress = await getOnChainWalletAddress(tokenId)
  if (!onChainAddress) {
    console.warn(`[ERC8004] getAgentWallet(${tokenId}) returned null`)
    return false
  }

  const matches = onChainAddress.toLowerCase() === claimedSignerAddress.toLowerCase()
  if (!matches) {
    console.warn(`[ERC8004] Identity mismatch: on-chain=${onChainAddress} claimed=${claimedSignerAddress}`)
  }
  return matches
}

/**
 * Submit on-chain reputation feedback to the ERC-8004 Reputation Registry.
 *
 * Called by the platform after every task outcome. The Reputation Registry
 * blocks self-feedback (isAuthorizedOrOwner check), so platform address ≠ agent NFT.
 *
 * The feedbackHash is keccak256(abi.encodePacked(taskId, outcome)) — a tamper-
 * evident digest any verifier can recompute from the task ID and outcome string.
 *
 * tag1 = outcome category, tag2 = taskId for per-task traceability.
 * Judges call getSummary(tokenId, [validatorAddress], outcome, "") on Arc testnet
 * to read an agent's reputation without relying on our backend.
 */
export async function submitReputationFeedback(
  swarmAgentId: string,
  taskId: string,
  outcome: 'subtask_success' | 'subtask_failure' | 'orchestrator_success' | 'orchestrator_failure',
  endpointUrl: string = ''
): Promise<string | null> {
  const signer = getValidatorSigner()
  if (!signer) {
    console.warn('[ERC8004] VALIDATOR_PRIVATE_KEY not set — skipping on-chain reputation')
    return null
  }

  const tokenId = await getAgentTokenId(swarmAgentId)
  if (tokenId == null) {
    console.warn(`[ERC8004] No tokenId for ${swarmAgentId} — skipping on-chain reputation`)
    return null
  }

  // Reputation scores: positive for success, negative for failure
  const OUTCOME_VALUES: Record<string, number> = {
    subtask_success:       1,
    subtask_failure:      -2,
    orchestrator_success:  3,
    orchestrator_failure: -5,
  }
  const rawValue = OUTCOME_VALUES[outcome] ?? 0
  // int128 value with 0 decimals (value * 10^0 = value)
  const value = BigInt(rawValue)
  const valueDecimals = 0

  // feedbackHash is a tamper-evident digest of the task+outcome
  const feedbackHash = ethers.keccak256(
    ethers.toUtf8Bytes(`${taskId}:${outcome}`)
  )

  const reputation = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, signer)
  try {
    const tx = await reputation.giveFeedback(
      tokenId,
      value,
      valueDecimals,
      outcome,           // tag1 = outcome category
      taskId,            // tag2 = task ID (per-task traceability)
      endpointUrl,       // endpoint = SwarmPay API base URL
      '',                // feedbackURI = no extended metadata for now
      feedbackHash
    )
    const receipt = await tx.wait()
    console.log(`[ERC8004] Reputation feedback submitted: ${swarmAgentId} ${outcome} tx=${receipt.hash}`)
    return receipt.hash as string
  } catch (e) {
    console.error('[ERC8004] giveFeedback() failed:', e)
    return null
  }
}

/**
 * Read an agent's on-chain reputation summary from the Reputation Registry.
 * Anyone can call this — no auth required.
 *
 * Returns: { count, totalScore, decimals }
 * The "score" is sum of all feedback values from our platform address.
 */
export async function getOnChainReputation(
  swarmAgentId: string
): Promise<{ count: number; totalScore: number; decimals: number } | null> {
  const provider = getIdentityProvider()
  if (!provider) return null

  const tokenId = await getAgentTokenId(swarmAgentId)
  if (tokenId == null) return null

  const validator = getValidatorSigner()
  const validatorAddress = validator ? await validator.getAddress() : ethers.ZeroAddress

  const reputation = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, provider)
  try {
    const [count, summaryValue, decimals] = await reputation.getSummary(
      tokenId,
      [validatorAddress],
      '',   // any tag1
      ''    // any tag2
    )
    return {
      count: Number(count),
      totalScore: Number(summaryValue),
      decimals: Number(decimals),
    }
  } catch (e) {
    console.error('[ERC8004] getSummary() failed:', e)
    return null
  }
}

/**
 * Look up the ERC-8004 tokenId for a SwarmPay agent.
 *
 * Order of lookup:
 *   1. ENV var: ERC8004_TOKEN_ID_<AGENT_ID_UPPERCASED_UNDERSCORED>
 *      e.g. ERC8004_TOKEN_ID_CRYPTO_SCOUT_X=42
 *   2. Supabase agents.erc8004_token_id column (set during registration)
 *
 * Returns null if the agent hasn't been registered yet.
 */
export async function getAgentTokenId(swarmAgentId: string): Promise<bigint | null> {
  // ENV var takes priority — avoids a DB round-trip in the hot path
  const envKey = `ERC8004_TOKEN_ID_${swarmAgentId.toUpperCase().replace(/-/g, '_')}`
  const envVal = process.env[envKey]
  if (envVal) return BigInt(envVal)

  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('agents')
    .select('erc8004_token_id')
    .eq('id', swarmAgentId)
    .single()

  return data?.erc8004_token_id ? BigInt(data.erc8004_token_id) : null
}

/**
 * Bootstrap: register all SwarmPay agents in the ERC-8004 registry if they
 * don't have tokenIds yet. Bind their Circle wallets.
 *
 * Call this ONCE from a setup script or the first pipeline invocation with
 * PLATFORM_PRIVATE_KEY set. Idempotent — skips agents already registered.
 *
 * After this runs, every agent has:
 *   - An ERC-8004 tokenId stored in env/Supabase
 *   - Their Circle wallet address bound on Arc testnet
 *   - An Arc explorer link verifiable by any judge
 */
export async function bootstrapAgentIdentities(): Promise<void> {
  const signer = getPlatformSigner()
  if (!signer) {
    console.log('[ERC8004] Skipping bootstrap — PLATFORM_PRIVATE_KEY not set')
    return
  }

  const agentWallets = getAgentWallets()
  const { resolveAgentAddress } = await import('./agentIdentity')

  for (const [swarmAgentId, circleWalletId] of Object.entries(agentWallets)) {
    if (!circleWalletId) continue

    const existingTokenId = await getAgentTokenId(swarmAgentId)
    if (existingTokenId != null) {
      console.log(`[ERC8004] ${swarmAgentId} already registered (tokenId=${existingTokenId})`)
      continue
    }

    // Build the agent metadata URI (inline JSON, base64 encoded for simplicity)
    const metadata = {
      type: 'agent',
      name: swarmAgentId,
      description: `SwarmPay autonomous agent — ${swarmAgentId}`,
      services: [{ type: 'a2a', url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/agents/${swarmAgentId}` }],
      x402Support: true,
      active: true,
      supportedTrust: ['reputation', 'crypto-economic'],
    }
    const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`

    const reg = await registerAgent(swarmAgentId, agentURI)
    if (!reg) continue

    // Persist registration tx to Supabase
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('agents')
        .update({ erc8004_register_tx: reg.txHash })
        .eq('id', swarmAgentId)
    }

    const circleWalletAddress = await resolveAgentAddress(swarmAgentId)
    if (!circleWalletAddress) {
      console.warn(`[ERC8004] Could not resolve Circle wallet address for ${swarmAgentId}`)
      continue
    }

    const bindTx = await bindAgentWallet(reg.tokenId, circleWalletId, circleWalletAddress)
    console.log(`[ERC8004] ${swarmAgentId} fully provisioned: tokenId=${reg.tokenId} registerTx=${reg.txHash} bindTx=${bindTx ?? 'failed'}`)
  }
}
