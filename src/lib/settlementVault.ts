/**
 * SettlementVault client — wraps the on-chain SwarmPay vault contract.
 *
 * Vault address: SETTLEMENT_VAULT_ADDRESS (Arc testnet)
 * Owner       : PLATFORM_PRIVATE_KEY (the deployer; only address allowed to settle batches)
 *
 * Why escrow:
 *   USDC on Arc is the NATIVE gas token (isNative=true, 18 decimals) — no ERC-20
 *   contract, no transferFrom path. To batch N micropayments atomically in ONE tx
 *   we need a contract that already custodies the senders' value. Agents pre-deposit
 *   into the vault once via Circle's createTransaction (native value transfer triggers
 *   the vault's receive() and credits balances[msg.sender]). After that, every task
 *   settles in a single platform-signed call to settleBatch — N PaymentSettled events
 *   + 1 BatchSettled event per task, atomic, ~30k gas per payment.
 */
import { ethers } from 'ethers'
import vaultArtifact from '../../artifacts/SettlementVault.json'

export interface VaultPayment {
  from: string
  to: string
  amount: bigint
}

export interface SettleBatchResult {
  txHash: string
  blockNumber: number
  gasUsed: bigint
  gasPriceWei: bigint
  totalGasCostUsdc: number
  paymentCount: number
  totalAmountUsdc: number
  explorerUrl: string
}

const ARC_EXPLORER = 'https://testnet.arcscan.app'

let providerSingleton: ethers.JsonRpcProvider | null = null
let signerSingleton: ethers.Wallet | null = null
let contractSingleton: ethers.Contract | null = null

function getProvider(): ethers.JsonRpcProvider | null {
  if (providerSingleton) return providerSingleton
  const rpc = process.env.ARC_RPC_URL
  if (!rpc) return null
  const chainId = parseInt(process.env.ARC_CHAIN_ID ?? '5042002', 10)
  providerSingleton = new ethers.JsonRpcProvider(rpc, chainId)
  return providerSingleton
}

function getOwnerSigner(): ethers.Wallet | null {
  if (signerSingleton) return signerSingleton
  const key = process.env.PLATFORM_PRIVATE_KEY
  const provider = getProvider()
  if (!key || !provider) return null
  signerSingleton = new ethers.Wallet(key, provider)
  return signerSingleton
}

export function getVaultAddress(): string | null {
  return process.env.SETTLEMENT_VAULT_ADDRESS ?? null
}

function getContract(): ethers.Contract | null {
  if (contractSingleton) return contractSingleton
  const addr = getVaultAddress()
  const signer = getOwnerSigner()
  if (!addr || !signer) return null
  contractSingleton = new ethers.Contract(addr, vaultArtifact.abi, signer)
  return contractSingleton
}

/**
 * Read one agent's escrowed balance (in 18-decimal USDC wei).
 */
export async function getVaultBalance(address: string): Promise<bigint> {
  const provider = getProvider()
  const addr = getVaultAddress()
  if (!provider || !addr) return BigInt(0)
  const c = new ethers.Contract(addr, vaultArtifact.abi, provider)
  return (await c.balanceOf(address)) as bigint
}

/**
 * Convert a USDC float (e.g. 0.05) to native 18-decimal wei.
 * Arc treats USDC as the native gas token with 18 decimals (confirmed via
 * Circle's getToken API: { isNative: true, decimals: 18 }).
 */
export function usdcToWei(usdc: number): bigint {
  return ethers.parseUnits(usdc.toFixed(18), 18)
}

export function weiToUsdc(wei: bigint): number {
  return Number(ethers.formatUnits(wei, 18))
}

/**
 * Submit a batch of payments to the vault. ATOMIC — all-or-nothing.
 *
 * The contract loops over payments[i] and for each:
 *   balances[from] -= amount
 *   balances[to]   += amount
 *   emit PaymentSettled(taskId, i, from, to, amount)
 * Then emits BatchSettled(taskId, count, total).
 *
 * Reverts (whole tx) if any payer's vault balance is insufficient.
 *
 * Returns the receipt summary so callers can persist a single tx hash
 * across N payment_intent rows + the settlements row.
 */
export async function settleBatchOnVault(
  taskId: string,
  payments: VaultPayment[]
): Promise<SettleBatchResult | null> {
  if (payments.length === 0) {
    console.warn('[VAULT] settleBatchOnVault called with empty payments')
    return null
  }
  const contract = getContract()
  if (!contract) {
    console.warn('[VAULT] contract unavailable (missing SETTLEMENT_VAULT_ADDRESS or PLATFORM_PRIVATE_KEY)')
    return null
  }

  // Cast taskId string to bytes32 (zero-pad-right keccak isn't needed; just hash deterministically).
  const taskIdBytes32 = ethers.id(taskId)

  // Encode struct[] for ethers.
  const encoded = payments.map(p => [p.from, p.to, p.amount])

  console.log(`[VAULT] submitting settleBatch — task=${taskId} (${taskIdBytes32}) payments=${payments.length}`)
  // Arc testnet's public RPC sporadically returns -32003 "txpool is full" under
  // load and silently drops the tx from mempool even after returning a hash.
  // Strategy: retry submission with progressively higher fees AND verify the tx
  // landed in mempool within 8s before awaiting the receipt; if it didn't, the
  // RPC dropped it — bump gas and resubmit on the same nonce so the next attempt
  // replaces the dropped tx.
  const provider = getProvider()!
  const baseFee = await provider.getFeeData()
  const baseMaxFee = baseFee.maxFeePerGas ?? BigInt('40000000000')
  const baseTip = baseFee.maxPriorityFeePerGas ?? BigInt('1000000000')

  let landedTx: ethers.ContractTransactionResponse | null = null
  let lastErr: unknown = null
  // Arc public RPC stays "txpool is full" for minutes during peak load. Retry
  // generously over a ~5min window — each attempt bumps the fee multiplier so
  // when the pool clears, our tx is already at a competitive price.
  // Backoff schedule (s): 5, 10, 20, 30, 45, 60, 60, 60, 60, 60 ≈ 7 min total.
  const backoffSchedule = [5000, 10000, 20000, 30000, 45000, 60000, 60000, 60000, 60000, 60000]
  const maxAttempts = backoffSchedule.length
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const multiplier = BigInt(Math.min(attempt + 1, 10)) // cap fee bump at 10x
    const overrides = {
      maxFeePerGas: baseMaxFee * multiplier,
      maxPriorityFeePerGas: baseTip * multiplier,
    }
    let attemptTx: ethers.ContractTransactionResponse
    try {
      attemptTx = await contract.settleBatch(taskIdBytes32, encoded, overrides)
      console.log(`[VAULT] attempt ${attempt}/${maxAttempts} submitted tx ${attemptTx.hash} (maxFee=${overrides.maxFeePerGas}, nonce=${attemptTx.nonce})`)
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      if (!/txpool is full|timeout|UNKNOWN_ERROR|-32003/i.test(msg)) {
        console.error(`[VAULT] non-retryable submit error: ${msg.slice(0, 200)}`)
        return null
      }
      if (attempt === maxAttempts) {
        console.error(`[VAULT] exhausted ${maxAttempts} submit attempts — Arc RPC stayed busy. Last error: ${msg.slice(0, 120)}`)
        return null
      }
      const backoffMs = backoffSchedule[attempt - 1]
      console.warn(`[VAULT] attempt ${attempt}/${maxAttempts} submit blocked (txpool busy). Retry in ${backoffMs / 1000}s`)
      await new Promise(r => setTimeout(r, backoffMs))
      continue
    }

    // Verify the tx is actually in the mempool / mined within 12s. If the RPC
    // accepted then dropped it, getTransaction(hash) will return null.
    let landed = false
    for (let probe = 0; probe < 8; probe++) {
      await new Promise(r => setTimeout(r, 1500))
      const onChain = await provider.getTransaction(attemptTx.hash).catch(() => null)
      if (onChain) { landed = true; break }
    }
    if (landed) {
      landedTx = attemptTx
      break
    }
    console.warn(`[VAULT] tx ${attemptTx.hash} dropped from mempool after submit. Backing off ${backoffSchedule[attempt - 1] / 1000}s and retrying.`)
    await new Promise(r => setTimeout(r, backoffSchedule[attempt - 1]))
  }

  if (!landedTx) {
    console.error('[VAULT] all submit attempts failed; last error:', lastErr)
    return null
  }
  try {
    let activeTx: ethers.ContractTransactionResponse = landedTx
    console.log(`[VAULT] awaiting receipt for ${activeTx.hash}…`)
    // Arc RPC sometimes drops pending txs even after they pass the mempool
    // probe. Don't trust .wait() to terminate — race it against a 10s timeout
    // and re-verify the tx still exists. If it's been evicted, resubmit on
    // the same nonce with a higher fee. Total budget: 75s.
    let receipt: ethers.ContractTransactionReceipt | null = null
    const startedAt = Date.now()
    const deadline = 75000
    while (Date.now() - startedAt < deadline) {
      const r = await Promise.race([
        activeTx.wait(),
        new Promise<null>(res => setTimeout(() => res(null), 10000)),
      ])
      if (r) { receipt = r as ethers.ContractTransactionReceipt; break }
      const stillThere = await provider.getTransaction(activeTx.hash).catch(() => null)
      if (!stillThere) {
        console.warn(`[VAULT] tx ${activeTx.hash} dropped during await. Bumping fee and resubmitting on nonce ${activeTx.nonce}.`)
        activeTx = await contract.settleBatch(taskIdBytes32, encoded, {
          maxFeePerGas: baseMaxFee * BigInt(8),
          maxPriorityFeePerGas: baseTip * BigInt(8),
          nonce: activeTx.nonce,
        })
        console.log(`[VAULT] resubmitted as ${activeTx.hash}`)
      } else {
        console.log(`[VAULT] still pending — ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`)
      }
    }
    if (!receipt) {
      console.error(`[VAULT] receipt did not arrive within ${deadline}ms`)
      return null
    }
    const gasUsed = receipt.gasUsed as bigint
    const gasPriceWei = (receipt.gasPrice ?? BigInt(0)) as bigint
    const gasCostWei = gasUsed * gasPriceWei
    const totalAmountWei = payments.reduce((s, p) => s + p.amount, BigInt(0))

    const result: SettleBatchResult = {
      txHash: receipt.hash as string,
      blockNumber: Number(receipt.blockNumber),
      gasUsed,
      gasPriceWei,
      totalGasCostUsdc: weiToUsdc(gasCostWei),
      paymentCount: payments.length,
      totalAmountUsdc: weiToUsdc(totalAmountWei),
      explorerUrl: `${ARC_EXPLORER}/tx/${receipt.hash}`,
    }
    console.log(
      `[VAULT] settleBatch confirmed: ${result.paymentCount} payments, ` +
      `total $${result.totalAmountUsdc.toFixed(6)}, gas $${result.totalGasCostUsdc.toFixed(6)}, block ${result.blockNumber}`
    )
    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[VAULT] settleBatch failed:', msg)
    return null
  }
}
