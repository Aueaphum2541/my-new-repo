import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  CONSTANTS,
  Enums,
  RenderingEngine,
  setVolumesForViewports,
  utilities,
  volumeLoader,
} from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'
import type { LoadedStudy } from '../types'
import { initCornerstone } from '../lib/cornerstone'

export type ClinicalTool = 'WindowLevel' | 'Pan' | 'Zoom' | 'Length' | 'Probe' | 'RectangleROI' | 'EllipticalROI' | 'Angle' | 'Crosshairs'
export type VolumePreset = 'brain' | 'bone' | 'vascular' | 'mip'

type Props = {
  loaded: LoadedStudy | null
  activeTool: ClinicalTool
  preset: VolumePreset
  windowCenter: number
  windowWidth: number
  onLoading?: (loading: boolean, message?: string) => void
  onError?: (message: string) => void
}

const VIEWPORT_IDS = {
  axial: 'NS3D_AXIAL',
  coronal: 'NS3D_CORONAL',
  sagittal: 'NS3D_SAGITTAL',
  volume: 'NS3D_VOLUME',
}

const TOOL_NAMES: Record<ClinicalTool, string> = {
  WindowLevel: cornerstoneTools.WindowLevelTool.toolName,
  Pan: cornerstoneTools.PanTool.toolName,
  Zoom: cornerstoneTools.ZoomTool.toolName,
  Length: cornerstoneTools.LengthTool.toolName,
  Probe: cornerstoneTools.ProbeTool.toolName,
  RectangleROI: cornerstoneTools.RectangleROITool.toolName,
  EllipticalROI: cornerstoneTools.EllipticalROITool.toolName,
  Angle: cornerstoneTools.AngleTool.toolName,
  Crosshairs: cornerstoneTools.CrosshairsTool.toolName,
}

const PRESET_CANDIDATES: Record<Exclude<VolumePreset, 'mip'>, string[]> = {
  brain: ['CT-Soft-Tissue', 'CT-Soft-Tissue-16', 'CT-AAA'],
  bone: ['CT-Bone', 'CT-Bones', 'CT-Bone-Gradient'],
  vascular: ['CT-Coronary-Arteries-2', 'CT-Coronary-Arteries', 'CT-AAA'],
}

function findPreset(names: string[]) {
  return CONSTANTS.VIEWPORT_PRESETS.find(p => names.includes(p.name)) ||
    CONSTANTS.VIEWPORT_PRESETS.find(p => /CT.*Soft|CT.*Bone/i.test(p.name)) ||
    CONSTANTS.VIEWPORT_PRESETS[0]
}

export default function CornerstoneViewportGrid({
  loaded,
  activeTool,
  preset,
  windowCenter,
  windowWidth,
  onLoading,
  onError,
}: Props) {
  const axialRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<RenderingEngine | null>(null)
  const toolGroup2DRef = useRef<any>(null)
  const toolGroup3DRef = useRef<any>(null)
  const volumeIdRef = useRef<string | null>(null)
  const [renderReady, setRenderReady] = useState(false)

  const instanceKey = useMemo(() => loaded ? `${loaded.study.studyInstanceUID}-${loaded.series.seriesInstanceUID}` : 'empty', [loaded])

  useEffect(() => {
    let disposed = false
    let resizeObserver: ResizeObserver | null = null

    async function build() {
      if (!loaded || !axialRef.current || !coronalRef.current || !sagittalRef.current || !volumeRef.current) return
      onLoading?.(true, 'Initializing GPU DICOM renderer…')
      setRenderReady(false)

      try {
        await initCornerstone()
        if (disposed) return

        const renderingEngineId = `NS3D_ENGINE_${Date.now()}`
        const volumeId = `cornerstoneStreamingImageVolume:NS3D_${Date.now()}`
        const toolGroup2DId = `NS3D_2D_${Date.now()}`
        const toolGroup3DId = `NS3D_3D_${Date.now()}`
        volumeIdRef.current = volumeId

        const renderingEngine = new RenderingEngine(renderingEngineId)
        engineRef.current = renderingEngine

        renderingEngine.setViewports([
          {
            viewportId: VIEWPORT_IDS.axial,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: axialRef.current,
            defaultOptions: { orientation: Enums.OrientationAxis.AXIAL, background: [0.01, 0.015, 0.02] },
          },
          {
            viewportId: VIEWPORT_IDS.coronal,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: coronalRef.current,
            defaultOptions: { orientation: Enums.OrientationAxis.CORONAL, background: [0.01, 0.015, 0.02] },
          },
          {
            viewportId: VIEWPORT_IDS.sagittal,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: sagittalRef.current,
            defaultOptions: { orientation: Enums.OrientationAxis.SAGITTAL, background: [0.01, 0.015, 0.02] },
          },
          {
            viewportId: VIEWPORT_IDS.volume,
            type: Enums.ViewportType.VOLUME_3D,
            element: volumeRef.current,
            defaultOptions: { background: [0.01, 0.015, 0.02], parallelProjection: true },
          },
        ] as any)

        const toolGroup2D = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroup2DId)
        const toolGroup3D = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroup3DId)
        toolGroup2DRef.current = toolGroup2D
        toolGroup3DRef.current = toolGroup3D

        const tools2D = [
          cornerstoneTools.WindowLevelTool,
          cornerstoneTools.PanTool,
          cornerstoneTools.ZoomTool,
          cornerstoneTools.StackScrollTool,
          cornerstoneTools.LengthTool,
          cornerstoneTools.ProbeTool,
          cornerstoneTools.RectangleROITool,
          cornerstoneTools.EllipticalROITool,
          cornerstoneTools.AngleTool,
          cornerstoneTools.CrosshairsTool,
        ].filter(Boolean)
        for (const tool of tools2D) toolGroup2D?.addTool(tool.toolName)

        toolGroup3D?.addTool(cornerstoneTools.TrackballRotateTool.toolName, { configuration: { volumeId } })
        toolGroup3D?.addTool(cornerstoneTools.ZoomTool.toolName)
        toolGroup3D?.addTool(cornerstoneTools.PanTool.toolName)

        for (const id of [VIEWPORT_IDS.axial, VIEWPORT_IDS.coronal, VIEWPORT_IDS.sagittal]) {
          toolGroup2D?.addViewport(id, renderingEngineId)
        }
        toolGroup3D?.addViewport(VIEWPORT_IDS.volume, renderingEngineId)

        const { MouseBindings } = cornerstoneTools.Enums
        toolGroup2D?.setToolActive(cornerstoneTools.ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] })
        toolGroup2D?.setToolActive(cornerstoneTools.PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] })
        toolGroup2D?.setToolActive(cornerstoneTools.StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] })
        toolGroup3D?.setToolActive(cornerstoneTools.TrackballRotateTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] })
        toolGroup3D?.setToolActive(cornerstoneTools.ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] })
        toolGroup3D?.setToolActive(cornerstoneTools.PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] })

        onLoading?.(true, `Streaming ${loaded.imageIds.length} real DICOM frames…`)
        const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: loaded.imageIds })
        volume.load()

        await setVolumesForViewports(
          renderingEngine,
          [{ volumeId }],
          [VIEWPORT_IDS.axial, VIEWPORT_IDS.coronal, VIEWPORT_IDS.sagittal, VIEWPORT_IDS.volume],
        )

        const low = windowCenter - windowWidth / 2
        const high = windowCenter + windowWidth / 2
        for (const id of [VIEWPORT_IDS.axial, VIEWPORT_IDS.coronal, VIEWPORT_IDS.sagittal]) {
          const viewport: any = renderingEngine.getViewport(id)
          viewport.setProperties?.({ voiRange: { lower: low, upper: high } })
          viewport.resetCamera?.()
        }

        const viewport3D: any = renderingEngine.getViewport(VIEWPORT_IDS.volume)
        const actorEntry = viewport3D.getDefaultActor?.()
        const selectedPreset = findPreset(PRESET_CANDIDATES.brain)
        if (actorEntry?.actor && selectedPreset) utilities.applyPreset(actorEntry.actor as never, selectedPreset)
        viewport3D.resetCamera?.()
        renderingEngine.render()

        resizeObserver = new ResizeObserver(() => renderingEngine.resize())
        ;[axialRef.current, coronalRef.current, sagittalRef.current, volumeRef.current].forEach(el => el && resizeObserver?.observe(el))

        if (!disposed) {
          setRenderReady(true)
          onLoading?.(false, `Rendered ${loaded.imageIds.length} DICOM frames`)
        }
      } catch (error) {
        console.error(error)
        if (!disposed) {
          onLoading?.(false)
          onError?.(error instanceof Error ? error.message : String(error))
        }
      }
    }

    build()

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      try { engineRef.current?.destroy() } catch {}
      engineRef.current = null
      try { if (toolGroup2DRef.current?.id) cornerstoneTools.ToolGroupManager.destroyToolGroup(toolGroup2DRef.current.id) } catch {}
      try { if (toolGroup3DRef.current?.id) cornerstoneTools.ToolGroupManager.destroyToolGroup(toolGroup3DRef.current.id) } catch {}
      toolGroup2DRef.current = null
      toolGroup3DRef.current = null
      volumeIdRef.current = null
    }
  }, [instanceKey])

  useEffect(() => {
    if (!renderReady || !toolGroup2DRef.current) return
    const group = toolGroup2DRef.current
    const { MouseBindings } = cornerstoneTools.Enums
    const selectedName = TOOL_NAMES[activeTool]
    for (const name of Object.values(TOOL_NAMES)) {
      try { group.setToolPassive(name) } catch {}
    }
    try {
      group.setToolActive(selectedName, { bindings: [{ mouseButton: MouseBindings.Primary }] })
    } catch (error) {
      console.warn('Unable to activate tool', selectedName, error)
    }
    try { group.setToolActive(cornerstoneTools.ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] }) } catch {}
    try { group.setToolActive(cornerstoneTools.PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] }) } catch {}
    try { group.setToolActive(cornerstoneTools.StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] }) } catch {}
  }, [activeTool, renderReady])

  useEffect(() => {
    if (!renderReady || !engineRef.current) return
    const low = windowCenter - windowWidth / 2
    const high = windowCenter + windowWidth / 2
    for (const id of [VIEWPORT_IDS.axial, VIEWPORT_IDS.coronal, VIEWPORT_IDS.sagittal]) {
      try {
        const viewport: any = engineRef.current.getViewport(id)
        viewport.setProperties?.({ voiRange: { lower: low, upper: high } })
        viewport.render?.()
      } catch {}
    }
  }, [windowCenter, windowWidth, renderReady])

  useEffect(() => {
    if (!renderReady || !engineRef.current) return
    try {
      const viewport3D: any = engineRef.current.getViewport(VIEWPORT_IDS.volume)
      if (preset === 'mip') {
        viewport3D.setBlendMode?.(Enums.BlendModes.MAXIMUM_INTENSITY_BLEND)
      } else {
        viewport3D.setBlendMode?.(Enums.BlendModes.COMPOSITE)
        const actor = viewport3D.getDefaultActor?.()?.actor
        const p = findPreset(PRESET_CANDIDATES[preset])
        if (actor && p) utilities.applyPreset(actor as never, p)
      }
      viewport3D.render?.()
    } catch (error) {
      console.warn('Preset change failed', error)
    }
  }, [preset, renderReady])

  const panel = (title: string, ref: RefObject<HTMLDivElement | null>, accent = false) => (
    <section className={`viewport-panel ${accent ? 'viewport-accent' : ''}`}>
      <div className="viewport-titlebar">
        <span>{title}</span>
        <span className="viewport-live"><i />LIVE DICOM</span>
      </div>
      <div ref={ref} className="cornerstone-viewport" onContextMenu={e => e.preventDefault()} />
      {!loaded && <div className="viewport-empty">No series loaded</div>}
      <div className="orientation-corners" aria-hidden="true"><span>R</span><span>L</span></div>
    </section>
  )

  return (
    <div className="diagnostic-grid">
      {panel('Axial MPR', axialRef)}
      {panel('3D Volume Rendering', volumeRef, true)}
      {panel('Coronal MPR', coronalRef)}
      {panel('Sagittal MPR', sagittalRef)}
    </div>
  )
}
