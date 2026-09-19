import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, Angle, Brain, ChevronRight, CircleDot, Crosshair,
  Database, Gauge, Layers3, Maximize2, Move, Orbit, Play, Ruler, Search,
  ShieldCheck, SlidersHorizontal, SquareDashedMousePointer, Upload, ZoomIn,
} from 'lucide-react'
import CornerstoneViewportGrid, { type ClinicalTool, type VolumePreset } from './components/CornerstoneViewportGrid'
import { findAndLoadFirstBrainSeries, loadCornerstonePublicSample, loadLocalDicomFiles, prettyDate, searchPublicBrainCT } from './lib/dicom'
import { requestInference } from './lib/ai'
import type { AIResult, LoadedStudy, StudyRow } from './types'

const WINDOW_PRESETS = [
  { label: 'Brain', wc: 40, ww: 80 },
  { label: 'Subdural', wc: 75, ww: 215 },
  { label: 'Stroke', wc: 32, ww: 8 },
  { label: 'Bone', wc: 600, ww: 2800 },
]

const TOOLS: { id: ClinicalTool; label: string; icon: any }[] = [
  { id: 'WindowLevel', label: 'Window / Level', icon: SlidersHorizontal },
  { id: 'Pan', label: 'Pan', icon: Move },
  { id: 'Zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'Length', label: 'Caliper', icon: Ruler },
  { id: 'Angle', label: 'Angle', icon: Angle },
  { id: 'Probe', label: 'HU Probe', icon: CircleDot },
  { id: 'RectangleROI', label: 'Rect ROI', icon: SquareDashedMousePointer },
  { id: 'Crosshairs', label: 'Crosshair', icon: Crosshair },
]

function formatProbability(v?: number) {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedStudy | null>(null)
  const [studies, setStudies] = useState<StudyRow[]>([])
  const [activeTool, setActiveTool] = useState<ClinicalTool>('WindowLevel')
  const [preset, setPreset] = useState<VolumePreset>('brain')
  const [windowCenter, setWindowCenter] = useState(40)
  const [windowWidth, setWindowWidth] = useState(80)
  const [status, setStatus] = useState('Ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ai, setAi] = useState<AIResult>({ status: 'unavailable', message: 'Run AI after loading a DICOMweb study.' })
  const [worklistOpen, setWorklistOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      setStatus('Querying public DICOMweb for a real CT brain/head study…')
      try {
        const rows = await searchPublicBrainCT(16)
        if (cancelled) return
        setStudies(rows)
        const brainStudy = rows.find(row => /HEAD|BRAIN|CRANI|CEREB/i.test(row.studyDescription))
        if (brainStudy) {
          const real = await findAndLoadFirstBrainSeries(brainStudy)
          if (!cancelled) setLoaded(real)
        } else {
          setStatus('No HEAD/BRAIN study returned by public QIDO. Showing real public Cornerstone CT fallback.')
          const fallback = await loadCornerstonePublicSample()
          if (!cancelled) setLoaded(fallback)
        }
      } catch (e) {
        console.warn('Public DICOM discovery failed; trying official sample', e)
        try {
          const fallback = await loadCornerstonePublicSample()
          if (!cancelled) setLoaded(fallback)
        } catch (fallbackError) {
          if (!cancelled) setError(fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const runInference = async () => {
    if (!loaded || loaded.source !== 'dicomweb') {
      setAi({ status: 'unavailable', message: 'Validated inference is only enabled for server-addressable DICOMweb studies.' })
      return
    }
    setAi({ status: 'unavailable', message: 'Contacting validation-gated inference service…' })
    setAi(await requestInference(loaded.study.studyInstanceUID, loaded.series.seriesInstanceUID))
  }

  const selectStudy = async (study: StudyRow) => {
    setWorklistOpen(false)
    setBusy(true)
    setError('')
    setStatus(`Loading ${study.studyDescription || 'CT study'}…`)
    try {
      setLoaded(await findAndLoadFirstBrainSeries(study))
      setAi({ status: 'unavailable', message: 'AI has not been run for this series.' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setStatus('Parsing and sorting local DICOM metadata…')
    try {
      setLoaded(await loadLocalDicomFiles(Array.from(files)))
      setAi({ status: 'unavailable', message: 'Local series stays in the browser. Server inference is disabled for this local-only dataset.' })
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const applyWindow = (wc: number, ww: number) => {
    setWindowCenter(wc)
    setWindowWidth(ww)
  }

  const aiBadge = ai.status === 'validated' ? 'badge validated' : ai.status === 'research' ? 'badge research' : 'badge unavailable'
  const patientName = loaded?.study.patientName || 'No patient loaded'
  const accession = loaded?.study.accessionNumber || '—'
  const seriesLabel = loaded?.series.description || '—'

  const graphPath = useMemo(() => {
    const center = Math.max(8, Math.min(92, 50 + windowCenter / 30))
    const spread = Math.max(8, Math.min(38, windowWidth / 70))
    return `M 5 88 C ${Math.max(5, center-spread*1.5)} 88, ${Math.max(10, center-spread)} 24, ${center} 24 C ${Math.min(90, center+spread)} 24, ${Math.min(95, center+spread*1.4)} 88, 98 88`
  }, [windowCenter, windowWidth])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Brain size={24}/></div><div><strong>NEURO-SYNAPSE <em>3D</em></strong><span>Real-Time Cerebral Volumetric CT Diagnostic Suite</span></div></div>
        <button className="searchbox" onClick={() => setWorklistOpen(true)}><Search size={16}/><span>Search DICOM studies / worklist</span><kbd>QIDO-RS</kbd></button>
        <nav><button className="nav-active">Studies</button><button>AI Analytics</button><button>Report</button></nav>
        <div className="physician"><div className="avatar">NR</div><div><strong>Neuro Viewer</strong><span>Research workstation</span></div></div>
      </header>

      <section className="patient-strip">
        <div className="patient-chip"><Activity size={19}/><div><span>Patient</span><strong>{patientName}</strong></div></div>
        <div><span>Accession #</span><strong>{accession}</strong></div>
        <div className="grow"><span>Study</span><strong>{loaded?.study.studyDescription || '—'}</strong></div>
        <div className="grow"><span>Series</span><strong>{seriesLabel}</strong></div>
        <div><span>Frames</span><strong>{loaded?.imageIds.length || 0}</strong></div>
        <div><span>Source</span><strong className="source-live"><i/>{loaded?.source === 'dicomweb' ? 'DICOMweb' : loaded ? 'Local DICOM' : 'Idle'}</strong></div>
      </section>

      <div className="workspace">
        <aside className="left-rail">
          <div className="rail-section"><h3>DIAGNOSTIC TOOLS</h3><div className="tool-grid">
            {TOOLS.map(({ id, label, icon: Icon }) => <button key={id} className={activeTool===id?'tool active':'tool'} onClick={()=>setActiveTool(id)}><Icon size={18}/><span>{label}</span></button>)}
          </div></div>

          <div className="rail-section"><h3>WINDOW / LEVEL</h3><div className="preset-grid">
            {WINDOW_PRESETS.map(w=><button key={w.label} className={windowCenter===w.wc&&windowWidth===w.ww?'mini active':'mini'} onClick={()=>applyWindow(w.wc,w.ww)}>{w.label}</button>)}
          </div>
          <label className="slider-label"><span>WC <b>{windowCenter}</b></span><input type="range" min="-100" max="1000" value={windowCenter} onChange={e=>setWindowCenter(Number(e.target.value))}/></label>
          <label className="slider-label"><span>WW <b>{windowWidth}</b></span><input type="range" min="1" max="3000" value={windowWidth} onChange={e=>setWindowWidth(Number(e.target.value))}/></label>
          </div>

          <div className="rail-section"><h3>3D RENDERING</h3><div className="preset-grid two">
            {(['brain','bone','vascular','mip'] as VolumePreset[]).map(p=><button key={p} className={preset===p?'mini active':'mini'} onClick={()=>setPreset(p)}>{p==='mip'?'MIP':p[0].toUpperCase()+p.slice(1)}</button>)}
          </div></div>

          <div className="rail-section"><h3>DATA</h3>
            <button className="wide-button" onClick={()=>setWorklistOpen(true)}><Database size={16}/> Public / Orthanc worklist <ChevronRight size={15}/></button>
            <button className="wide-button" onClick={()=>fileInputRef.current?.click()}><Upload size={16}/> Load local DICOM series</button>
            <input ref={fileInputRef} hidden multiple type="file" onChange={e=>handleFiles(e.target.files)} />
          </div>
          <div className="privacy-note"><ShieldCheck size={16}/><span>Local DICOM stays in this browser session. No synthetic image is substituted when loading fails.</span></div>
        </aside>

        <section className="viewer-zone">
          <CornerstoneViewportGrid
            loaded={loaded}
            activeTool={activeTool}
            preset={preset}
            windowCenter={windowCenter}
            windowWidth={windowWidth}
            onLoading={(v,m)=>{setBusy(v); if(m)setStatus(m)}}
            onError={setError}
          />
          <div className="timeline-dock">
            <div className="timeline-title"><Layers3 size={17}/><div><strong>Series timeline</strong><span>{loaded ? `${loaded.series.numberOfInstances || loaded.imageIds.length} frames · ${loaded.series.modality}` : 'No study'}</span></div></div>
            <div className="phase active"><span>1</span><div><strong>Current CT series</strong><small>{seriesLabel}</small></div></div>
            <div className="scrub"><button aria-label="play"><Play size={16}/></button><input type="range" min="1" max={Math.max(2, loaded?.imageIds.length||2)} defaultValue={Math.max(1, Math.floor((loaded?.imageIds.length||2)/2))}/><b>{loaded?.imageIds.length || 0}</b></div>
            <button className="icon-button"><Maximize2 size={17}/></button>
          </div>
        </section>

        <aside className="right-rail">
          <div className="tabs"><button className="active">AI Insights</button><button>Report</button><button>Anatomy</button></div>
          <section className="insight-card">
            <div className="section-title"><span>AI ANALYSIS</span><span className={aiBadge}>{ai.status}</span></div>
            <div className="ai-gate"><ShieldCheck size={22}/><div><strong>Validation-gated inference</strong><p>{ai.message || (ai.status==='validated'?'Validated model package responded successfully.':'No validated result available.')}</p></div></div>
            <button className="primary-button" onClick={runInference} disabled={!loaded || busy}><Brain size={16}/> Run ICH + aneurysm service</button>
            <div className="metric-row"><span>ICH finding</span><strong>{ai.ich?.finding || '—'}</strong><b>{formatProbability(ai.ich?.probability)}</b></div>
            <div className="metric-row"><span>Aneurysm</span><strong>{ai.aneurysm?.finding || '—'}</strong><b>{formatProbability(ai.aneurysm?.probability)}</b></div>
            <div className="metric-row"><span>Midline shift</span><strong>{typeof ai.midlineShiftMm==='number'?`${ai.midlineShiftMm.toFixed(1)} mm`:'—'}</strong><b>{ai.validationId || '—'}</b></div>
          </section>

          <section className="insight-card">
            <div className="section-title"><span>HU TRANSFER FUNCTION</span><span>{windowCenter} / {windowWidth}</span></div>
            <svg className="transfer" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#d7e0e9"/><stop offset=".5" stopColor="#617386"/><stop offset="1" stopColor="#111827"/></linearGradient></defs><path d="M2 90 C 18 84, 20 50, 35 64 S 58 20, 72 62 S 88 76, 98 88 L 98 96 L 2 96 Z" fill="url(#g)" opacity=".45"/><path d={graphPath} fill="none" stroke="#087e8b" strokeWidth="1.6"/><line x1="50" x2="50" y1="8" y2="94" stroke="#e4a11b" strokeWidth=".7" strokeDasharray="3 2"/></svg>
            <div className="axis"><span>-1000 HU</span><span>0</span><span>+1000 HU</span></div>
          </section>

          <section className="insight-card">
            <div className="section-title"><span>DICOM METADATA</span><span className="mono">QIDO/WADO-RS</span></div>
            <dl className="metadata">
              <div><dt>Study date</dt><dd>{prettyDate(loaded?.study.studyDate || '')}</dd></div>
              <div><dt>Modality</dt><dd>{loaded?.series.modality || '—'}</dd></div>
              <div><dt>Body part</dt><dd>{loaded?.series.bodyPart || '—'}</dd></div>
              <div><dt>Series UID</dt><dd className="uid">{loaded?.series.seriesInstanceUID || '—'}</dd></div>
              <div><dt>Study UID</dt><dd className="uid">{loaded?.study.studyInstanceUID || '—'}</dd></div>
            </dl>
          </section>

          <section className="insight-card architecture-card"><div className="section-title"><span>PIPELINE</span><Gauge size={15}/></div>
            <div className="pipeline"><span>QIDO-RS</span><ChevronRight/><span>WADO-RS</span><ChevronRight/><span>WASM codecs</span><ChevronRight/><span>GPU volume</span></div>
            <div className="pipeline"><span>Orthanc</span><ChevronRight/><span>OHIF</span><ChevronRight/><span>Inference API</span></div>
          </section>
        </aside>
      </div>

      <footer className="footerbar"><span className="ok-dot"/><b>NEURO-SYNAPSE 3D v2</b><span>Cornerstone3D · WebGL/WebGPU-ready · DICOMweb</span><span className="footer-spacer"/><span className="warning"><AlertTriangle size={14}/> Research prototype — not cleared for clinical diagnosis</span></footer>

      {(busy || error) && <div className={`toast ${error?'error':''}`}><div>{error ? <AlertTriangle size={18}/> : <Orbit size={18} className="spin"/>}<span><strong>{error?'Imaging pipeline error':'Imaging pipeline'}</strong>{error||status}</span></div>{error&&<button onClick={()=>setError('')}>×</button>}</div>}

      {worklistOpen && <div className="modal-backdrop" onMouseDown={()=>setWorklistOpen(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-head"><div><strong>Real DICOM Worklist</strong><span>Public demo or configured Orthanc QIDO-RS</span></div><button onClick={()=>setWorklistOpen(false)}>×</button></div>
        <div className="modal-search"><Search size={17}/><input placeholder="Public studies discovered from DICOMweb" readOnly/><button onClick={async()=>{setBusy(true);try{setStudies(await searchPublicBrainCT(30))}finally{setBusy(false)}}}>Refresh QIDO</button></div>
        <div className="study-list">{studies.length ? studies.map(s=><button key={s.studyInstanceUID} onClick={()=>selectStudy(s)}><div><strong>{s.studyDescription || 'CT Study'}</strong><span>{s.patientName} · {prettyDate(s.studyDate)}</span></div><div><b>{s.modalities}</b><span>{s.numberOfSeries||'—'} series</span></div><ChevronRight size={17}/></button>) : <div className="empty-worklist"><Database size={28}/><strong>No QIDO results yet</strong><span>Configure DICOMWEB_BASE_URL for your Orthanc/PACS or load a local DICOM series.</span></div>}</div>
      </div></div>}
    </main>
  )
}
