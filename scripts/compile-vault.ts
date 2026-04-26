/**
 * Compile contracts/SettlementVault.sol with solc 0.8.24 and write
 * the artifact (abi + bytecode) to artifacts/SettlementVault.json.
 *
 * Standalone compile keeps the toolchain footprint to a single
 * dev dep (solc) — no Foundry / Hardhat install required.
 */
import * as fs from 'fs'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solc = require('solc')

const SRC = path.resolve(__dirname, '../contracts/SettlementVault.sol')
const OUT_DIR = path.resolve(__dirname, '../artifacts')
const OUT = path.join(OUT_DIR, 'SettlementVault.json')

function main() {
  const source = fs.readFileSync(SRC, 'utf8')
  const input = {
    language: 'Solidity',
    sources: { 'SettlementVault.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
      },
    },
  }
  const out = JSON.parse(solc.compile(JSON.stringify(input)))
  if (out.errors?.length) {
    const fatal = out.errors.filter((e: { severity: string }) => e.severity === 'error')
    if (fatal.length) {
      console.error('[COMPILE] solc errors:\n' + fatal.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'))
      process.exit(1)
    }
    console.warn('[COMPILE] solc warnings:\n' + out.errors.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'))
  }
  const c = out.contracts['SettlementVault.sol'].SettlementVault
  if (!c) { console.error('[COMPILE] SettlementVault contract not found in output'); process.exit(1) }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    OUT,
    JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, deployedBytecode: '0x' + c.evm.deployedBytecode.object }, null, 2),
  )
  console.log(`[COMPILE] wrote ${OUT} (bytecode ${c.evm.bytecode.object.length / 2} bytes)`)
}

main()
