import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader'
import {
  cornerstoneStreamingDynamicImageVolumeLoader,
  cornerstoneStreamingImageVolumeLoader,
  decimatedVolumeLoader,
  init as coreInit,
  volumeLoader,
} from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'

let initPromise: Promise<void> | null = null
let toolsRegistered = false

export async function initCornerstone() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)),
    })

    volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader)
    volumeLoader.registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader)
    volumeLoader.registerVolumeLoader('cornerstoneStreamingDynamicImageVolume', cornerstoneStreamingDynamicImageVolumeLoader)
    volumeLoader.registerVolumeLoader('decimatedVolumeLoader', decimatedVolumeLoader)

    await coreInit()
    await cornerstoneTools.init()

    if (!toolsRegistered) {
      const tools = [
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
        cornerstoneTools.TrackballRotateTool,
      ].filter(Boolean)

      for (const tool of tools) {
        try {
          cornerstoneTools.addTool(tool as never)
        } catch {
          // addTool is global and throws when the same tool is registered twice.
        }
      }
      toolsRegistered = true
    }
  })()

  return initPromise
}
