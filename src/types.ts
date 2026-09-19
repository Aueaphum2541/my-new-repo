export type DicomJsonElement = {
  vr?: string
  Value?: unknown[]
  BulkDataURI?: string
  InlineBinary?: string
}

export type DicomJson = Record<string, DicomJsonElement>

export type StudyRow = {
  studyInstanceUID: string
  patientName: string
  patientId: string
  studyDate: string
  studyDescription: string
  modalities: string
  accessionNumber: string
  numberOfSeries: number
  numberOfInstances: number
}

export type SeriesRow = {
  studyInstanceUID: string
  seriesInstanceUID: string
  seriesNumber: number
  description: string
  modality: string
  bodyPart: string
  numberOfInstances: number
}

export type LoadedStudy = {
  study: StudyRow
  series: SeriesRow
  imageIds: string[]
  source: 'dicomweb' | 'local'
}

export type AIResult = {
  status: 'validated' | 'research' | 'unavailable'
  modelVersion?: string
  validationId?: string
  ich?: {
    probability: number
    finding: 'positive' | 'negative' | 'indeterminate'
    volumeMl?: number
    maxHu?: number
    bboxWorld?: [number, number, number, number, number, number]
  }
  aneurysm?: {
    probability: number
    finding: 'positive' | 'negative' | 'indeterminate'
    maxDiameterMm?: number
    stenosisPercent?: number
  }
  midlineShiftMm?: number
  message?: string
}
