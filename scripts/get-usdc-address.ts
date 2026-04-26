import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

;(async () => {
  const c = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  }) as any
  const tok = await c.getToken({ id: process.env.USDC_TOKEN_ID })
  console.log(JSON.stringify(tok.data, null, 2))
})().catch(e => { console.error(e); process.exit(1) })
