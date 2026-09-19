import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

const ResultSchema = z.object({
  status: z.enum(['validated', 'research']),
  modelVersion: z.string().min(1),
  validationId: z.string().min(1),
  ich: z.object({
    probability: z.number().min(0).max(1),
    finding: z.enum(['positive', 'negative', 'indeterminate']),
    volumeMl: z.number().nonnegative().optional(),
    maxHu: z.number().optional(),
    bboxWorld: z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]).optional(),
  }).optional(),
  aneurysm: z.object({
    probability: z.number().min(0).max(1),
    finding: z.enum(['positive', 'negative', 'indeterminate']),
    maxDiameterMm: z.number().nonnegative().optional(),
    stenosisPercent: z.number().min(0).max(100).optional(),
  }).optional(),
  midlineShiftMm: z.number().nonnegative().optional(),
  message: z.string().optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const studyInstanceUID = String(req.query.studyInstanceUID || '')
  const seriesInstanceUID = String(req.query.seriesInstanceUID || '')
  if (!studyInstanceUID || !seriesInstanceUID) return res.status(400).json({ status:'unavailable', error:'Study and series UID are required.' })

  const root = process.env.INFERENCE_BASE_URL?.replace(/\/$/, '')
  if (!root) return res.status(503).json({
    status: 'unavailable',
    message: 'No clinically validated inference endpoint is configured. The UI will not fabricate an ICH or aneurysm result.',
  })

  const url = new URL(`${root}/v1/analyze`)
  url.searchParams.set('studyInstanceUID', studyInstanceUID)
  url.searchParams.set('seriesInstanceUID', seriesInstanceUID)

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(process.env.INFERENCE_API_KEY ? { Authorization: `Bearer ${process.env.INFERENCE_API_KEY}` } : {}),
      },
    })
    const json = await upstream.json()
    if (!upstream.ok) return res.status(502).json({ status:'unavailable', message: json?.message || `Inference service returned ${upstream.status}` })
    const parsed = ResultSchema.safeParse(json)
    if (!parsed.success) return res.status(502).json({ status:'unavailable', message:'Inference payload failed the NEURO-SYNAPSE validation contract.' })
    if (parsed.data.status !== 'validated' && process.env.INFERENCE_ALLOW_RESEARCH !== 'true') {
      return res.status(412).json({ status:'unavailable', message:'Model responded in research mode. Production UI only exposes validation-approved outputs.' })
    }
    return res.status(200).json(parsed.data)
  } catch (error) {
    return res.status(502).json({ status:'unavailable', message: error instanceof Error ? error.message : String(error) })
  }
}
