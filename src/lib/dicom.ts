import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader'
import dicomParser from 'dicom-parser'
import { utilities as metadataUtilities } from '@cornerstonejs/metadata'
import type { DicomJson, LoadedStudy, SeriesRow, StudyRow } from '../types'

const DEFAULT_PUBLIC_DICOMWEB = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb'
export const CORNERSTONE_REAL_CT_SAMPLE = {
  studyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
  seriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
  description: 'Cornerstone public de-identified CT volume',
}

export function getDicomWebRoot() {
  const configured = (import.meta.env.VITE_DICOMWEB_ROOT as string | undefined)?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined') return `${window.location.origin}/api/dicomweb`
  return DEFAULT_PUBLIC_DICOMWEB
}

function firstValue(ds: DicomJson, tag: string): unknown {
  return ds?.[tag]?.Value?.[0]
}

function str(ds: DicomJson, tag: string, fallback = ''): string {
  const value = firstValue(ds, tag)
  if (value == null) return fallback
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value && 'Alphabetic' in value) {
    return String((value as { Alphabetic?: string }).Alphabetic || fallback).replace(/\^/g, ' ')
  }
  return fallback
}

function num(ds: DicomJson, tag: string, fallback = 0): number {
  const v = Number(firstValue(ds, tag))
  return Number.isFinite(v) ? v : fallback
}

function list(ds: DicomJson, tag: string): string[] {
  const values = ds?.[tag]?.Value || []
  return values.map(v => String(v))
}

async function dicomJson(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/dicom+json' } })
  if (!res.ok) throw new Error(`DICOMweb request failed (${res.status}) ${res.statusText}`)
  return (await res.json()) as DicomJson[]
}

function studyFromJson(ds: DicomJson): StudyRow {
  return {
    studyInstanceUID: str(ds, '0020000D'),
    patientName: str(ds, '00100010', 'ANON / PUBLIC DATASET'),
    patientId: str(ds, '00100020', '—'),
    studyDate: str(ds, '00080020', '—'),
    studyDescription: str(ds, '00081030', 'CT Study'),
    modalities: list(ds, '00080061').join('\\') || str(ds, '00080060', 'CT'),
    accessionNumber: str(ds, '00080050', '—'),
    numberOfSeries: num(ds, '00201206'),
    numberOfInstances: num(ds, '00201208'),
  }
}

function seriesFromJson(studyInstanceUID: string, ds: DicomJson): SeriesRow {
  return {
    studyInstanceUID,
    seriesInstanceUID: str(ds, '0020000E'),
    seriesNumber: num(ds, '00200011'),
    description: str(ds, '0008103E', 'CT Series'),
    modality: str(ds, '00080060', 'CT'),
    bodyPart: str(ds, '00180015', ''),
    numberOfInstances: num(ds, '00201209'),
  }
}

function brainScore(s: SeriesRow) {
  const t = `${s.description} ${s.bodyPart}`.toUpperCase()
  let score = s.numberOfInstances / 100
  if (/HEAD|BRAIN|CRANI|CEREB/.test(t)) score += 100
  if (/AXIAL|AX|NCCT|NON.?CONTRAST|CTA|ANGIO/.test(t)) score += 20
  if (/SCOUT|LOCALIZER|TOPOGRAM|DOSE|REPORT/.test(t)) score -= 100
  if (s.numberOfInstances < 16) score -= 50
  return score
}

export async function loadCornerstonePublicSample(): Promise<LoadedStudy> {
  const root = DEFAULT_PUBLIC_DICOMWEB
  const study: StudyRow = {
    studyInstanceUID: CORNERSTONE_REAL_CT_SAMPLE.studyInstanceUID,
    patientName: 'DE-IDENTIFIED PUBLIC DATASET',
    patientId: 'PUBLIC',
    studyDate: '—',
    studyDescription: CORNERSTONE_REAL_CT_SAMPLE.description,
    modalities: 'CT',
    accessionNumber: 'PUBLIC',
    numberOfSeries: 1,
    numberOfInstances: 0,
  }
  const series: SeriesRow = {
    studyInstanceUID: study.studyInstanceUID,
    seriesInstanceUID: CORNERSTONE_REAL_CT_SAMPLE.seriesInstanceUID,
    seriesNumber: 1,
    description: 'Public CT volume',
    modality: 'CT',
    bodyPart: '',
    numberOfInstances: 0,
  }
  return loadDicomWebSeries(study, series, root)
}

export async function searchPublicBrainCT(limit = 18): Promise<StudyRow[]> {
  const root = getDicomWebRoot()
  const attempts = [
    `${root}/studies?ModalitiesInStudy=CT&StudyDescription=*HEAD*&limit=${limit}&includefield=all`,
    `${root}/studies?ModalitiesInStudy=CT&StudyDescription=*BRAIN*&limit=${limit}&includefield=all`,
    `${root}/studies?ModalitiesInStudy=CT&limit=${limit}&includefield=all`,
  ]
  for (const url of attempts) {
    try {
      const rows = (await dicomJson(url)).map(studyFromJson).filter(s => s.studyInstanceUID)
      if (rows.length) return rows
    } catch (error) {
      if (url === attempts.at(-1)) throw error
    }
  }
  return []
}

export async function searchStudies(query: string, limit = 30): Promise<StudyRow[]> {
  const root = getDicomWebRoot()
  const q = query.trim()
  const params = new URLSearchParams({ limit: String(limit), includefield: 'all' })
  if (q) {
    params.set('PatientName', `*${q}*`)
    params.set('fuzzymatching', 'true')
  }
  const studies = await dicomJson(`${root}/studies?${params}`)
  return studies.map(studyFromJson).filter(s => s.studyInstanceUID)
}

export async function getSeries(studyInstanceUID: string): Promise<SeriesRow[]> {
  const root = getDicomWebRoot()
  const rows = await dicomJson(`${root}/studies/${encodeURIComponent(studyInstanceUID)}/series?Modality=CT&limit=200&includefield=all`)
  return rows
    .map(row => seriesFromJson(studyInstanceUID, row))
    .filter(s => s.seriesInstanceUID && s.modality === 'CT')
    .sort((a, b) => brainScore(b) - brainScore(a))
}

export async function loadDicomWebSeries(study: StudyRow, series: SeriesRow, explicitRoot?: string): Promise<LoadedStudy> {
  const root = (explicitRoot || getDicomWebRoot()).replace(/\/$/, '')
  const metadataUrl = `${root}/studies/${encodeURIComponent(study.studyInstanceUID)}/series/${encodeURIComponent(series.seriesInstanceUID)}/metadata`
  const instances = await dicomJson(metadataUrl)
  if (!instances.length) throw new Error('No DICOM instances were returned for this series.')

  const imageIds = instances
    .map(instanceMetaData => {
      const sop = str(instanceMetaData, '00080018')
      if (!sop) return null
      const imageId = `wadors:${root}/studies/${study.studyInstanceUID}/series/${series.seriesInstanceUID}/instances/${sop}/frames/1`
      cornerstoneDICOMImageLoader.wadors.metaDataManager.add(imageId, instanceMetaData)
      try {
        metadataUtilities.addDicomWebInstance(imageId, instanceMetaData as never)
      } catch {
        // Legacy metadata provider remains available as a compatibility fallback.
      }
      return imageId
    })
    .filter((id): id is string => Boolean(id))

  if (imageIds.length < 2) throw new Error('This series has fewer than two image frames and cannot be reconstructed as a volume.')
  return {
    study: { ...study, numberOfInstances: study.numberOfInstances || imageIds.length },
    series: { ...series, numberOfInstances: series.numberOfInstances || imageIds.length },
    imageIds,
    source: 'dicomweb',
  }
}

export async function loadLocalDicomFiles(files: File[]): Promise<LoadedStudy> {
  if (files.length < 2) throw new Error('Select a CT series containing at least two DICOM files.')

  type Parsed = {
    file: File
    studyUID: string
    seriesUID: string
    sopUID: string
    modality: string
    bodyPart: string
    patientName: string
    patientId: string
    studyDate: string
    studyDescription: string
    seriesDescription: string
    accessionNumber: string
    instanceNumber: number
    z: number
  }

  const parsed: Parsed[] = []
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const ds = dicomParser.parseDicom(bytes)
      const position = (ds.string('x00200032') || '').split('\\').map(Number)
      parsed.push({
        file,
        studyUID: ds.string('x0020000d') || `local-${Date.now()}`,
        seriesUID: ds.string('x0020000e') || `local-series-${Date.now()}`,
        sopUID: ds.string('x00080018') || file.name,
        modality: ds.string('x00080060') || 'CT',
        bodyPart: ds.string('x00180015') || '',
        patientName: (ds.string('x00100010') || 'LOCAL DICOM').replace(/\^/g, ' '),
        patientId: ds.string('x00100020') || 'LOCAL',
        studyDate: ds.string('x00080020') || '—',
        studyDescription: ds.string('x00081030') || 'Local DICOM study',
        seriesDescription: ds.string('x0008103e') || 'Local DICOM series',
        accessionNumber: ds.string('x00080050') || 'LOCAL',
        instanceNumber: Number(ds.string('x00200013') || 0),
        z: Number.isFinite(position[2]) ? position[2] : Number(ds.string('x00201041') || 0),
      })
    } catch {
      // Ignore non-DICOM files in a selected directory.
    }
  }
  if (parsed.length < 2) throw new Error('No readable DICOM CT series was found in the selected files.')

  const groups = new Map<string, Parsed[]>()
  for (const item of parsed.filter(p => p.modality === 'CT')) {
    const arr = groups.get(item.seriesUID) || []
    arr.push(item)
    groups.set(item.seriesUID, arr)
  }
  const candidates = [...groups.values()].sort((a, b) => {
    const score = (items: Parsed[]) => {
      const t = `${items[0]?.seriesDescription} ${items[0]?.bodyPart}`.toUpperCase()
      return items.length + (/HEAD|BRAIN|CRANI|CEREB/.test(t) ? 10000 : 0) - (/SCOUT|LOCALIZER|TOPOGRAM/.test(t) ? 20000 : 0)
    }
    return score(b) - score(a)
  })
  const selected = candidates[0]
  if (!selected || selected.length < 2) throw new Error('No multi-slice CT series was found in the selected files.')

  selected.sort((a, b) => (a.z - b.z) || (a.instanceNumber - b.instanceNumber) || a.file.name.localeCompare(b.file.name))
  const imageIds = selected.map(item => cornerstoneDICOMImageLoader.wadouri.fileManager.add(item.file))
  const first = selected[0]
  const study: StudyRow = {
    studyInstanceUID: first.studyUID,
    patientName: first.patientName,
    patientId: first.patientId,
    studyDate: first.studyDate,
    studyDescription: first.studyDescription,
    modalities: 'CT',
    accessionNumber: first.accessionNumber,
    numberOfSeries: groups.size,
    numberOfInstances: selected.length,
  }
  const series: SeriesRow = {
    studyInstanceUID: first.studyUID,
    seriesInstanceUID: first.seriesUID,
    seriesNumber: 1,
    description: first.seriesDescription,
    modality: first.modality,
    bodyPart: first.bodyPart,
    numberOfInstances: selected.length,
  }
  return { study, series, imageIds, source: 'local' }
}

export async function findAndLoadFirstBrainSeries(study: StudyRow) {
  const series = await getSeries(study.studyInstanceUID)
  if (!series.length) throw new Error('No CT series found in this study.')
  const preferred = series.find(s => brainScore(s) >= 80) || series[0]
  return loadDicomWebSeries(study, preferred)
}

export function prettyDate(raw: string) {
  if (!/^\d{8}$/.test(raw)) return raw || '—'
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}
