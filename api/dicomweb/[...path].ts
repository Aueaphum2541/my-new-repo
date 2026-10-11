import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEFAULT_UPSTREAM = 'https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs'

function upstreamRoot() {
  return (process.env.DICOMWEB_BASE_URL || DEFAULT_UPSTREAM).replace(/\/$/, '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS')
    return res.status(204).end()
  }
  if (!['GET', 'HEAD'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' })

  const parts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean)
  const path = parts.map(p => encodeURIComponent(String(p))).join('/')
  const rawUrl = req.url || ''
  const queryIndex = rawUrl.indexOf('?')
  const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : ''
  const url = `${upstreamRoot()}/${path}${query}`

  const headers: Record<string, string> = {}
  const accept = req.headers.accept
  if (accept) headers.Accept = accept
  const range = req.headers.range
  if (range) headers.Range = range
  if (process.env.DICOMWEB_AUTH_HEADER) headers.Authorization = process.env.DICOMWEB_AUTH_HEADER

  try {
    const upstream = await fetch(url, { method: req.method, headers, redirect: 'follow' })
    res.status(upstream.status)
    for (const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','cache-control']) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    res.setHeader('X-Neuro-Synapse-DICOMweb', 'proxy')
    if (req.method === 'HEAD') return res.end()
    const body = Buffer.from(await upstream.arrayBuffer())
    return res.send(body)
  } catch (error) {
    return res.status(502).json({
      error: 'DICOMweb upstream unavailable',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
