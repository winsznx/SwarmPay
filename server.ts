import { createServer } from 'http'

import next from 'next'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
console.log('[SERVER] Environment loaded. OpenAI Key:', !!process.env.OPENAI_API_KEY);

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })


  server.listen(3001, () => {
    console.log('[SERVER] Next.js ready on http://localhost:3001')
  })
})
