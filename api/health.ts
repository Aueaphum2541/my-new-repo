import type { VercelRequest, VercelResponse } from '@vercel/node'
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    service: 'NEURO-SYNAPSE 3D',
    dicomweb: process.env.DICOMWEB_BASE_URL ? 'configured' : 'public-demo-fallback',
    inference: process.env.INFERENCE_BASE_URL ? 'configured' : 'not-configured',
    note: 'Clinical inference is exposed only when the upstream declares a validated model package.',
  })
}
