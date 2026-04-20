import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { startWsServer } from './src/lib/wsServer'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
console.log('[SERVER] Environment loaded. OpenAI Key:', !!process.env.OPENAI_API_KEY);

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  startWsServer()
  console.log('[SERVER] WebSocket server started on port 3006')

  server.listen(3001, () => {
    console.log('[SERVER] Next.js ready on http://localhost:3001')
  })
})
