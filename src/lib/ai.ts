import type { AIResult } from '../types'

export async function requestInference(studyInstanceUID: string, seriesInstanceUID: string): Promise<AIResult> {
  const params = new URLSearchParams({ studyInstanceUID, seriesInstanceUID })
  const res = await fetch(`/api/inference?${params}`, { headers: { Accept: 'application/json' } })
  const payload = (await res.json()) as AIResult & { error?: string }
  if (!res.ok) {
    return {
      status: 'unavailable',
      message: payload.message || payload.error || `AI service unavailable (${res.status})`,
    }
  }
  return payload
}
