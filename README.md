# NEURO-SYNAPSE 3D v2

A white-theme neuroradiology research workstation built around **real DICOM data**. The frontend uses Cornerstone3D for synchronized axial/coronal/sagittal MPR and GPU volume rendering; it does not draw synthetic brain slices as a fallback.

## What is implemented

- React 19 + TypeScript + Vite, Vercel-ready
- Cornerstone3D volume rendering with 4 synchronized clinical viewports
- DICOM WADO-RS and QIDO-RS access through a same-origin Vercel proxy
- Local DICOM series loading in the browser
- Cornerstone DICOM Image Loader with Web Worker / WASM compressed-transfer-syntax decoding
- 3D brain/soft-tissue, bone, vascular-style and MIP presets
- Window/level, pan, zoom, caliper, angle, HU probe, rectangle ROI and crosshair tools
- Orthanc + DICOMweb + GDCM + OHIF Docker backend recipe
- Validation-gated ICH/aneurysm inference contract that refuses to fabricate predictions if no approved model package is installed

## Run locally

```bash
npm install
npm run dev
```

The Vite-only dev server does not execute the `/api/*` Vercel functions. For local development, point `VITE_DICOMWEB_ROOT` at a CORS-enabled DICOMweb server, or run with Vercel's local runtime.

## Vercel configuration

For a real PACS/Orthanc deployment, set:

```text
DICOMWEB_BASE_URL=https://your-orthanc.example/dicom-web
DICOMWEB_AUTH_HEADER=Basic ...        # optional, server-side only
INFERENCE_BASE_URL=https://your-validated-inference-service.example
INFERENCE_API_KEY=...                  # optional, server-side only
```

The browser calls `/api/dicomweb`, so PACS credentials are not exposed to the client.

## Orthanc + OHIF

```bash
cd backend/orthanc
cp .env.example .env
# change ORTHANC_PASSWORD
docker compose up -d
```

Orthanc runs on HTTP 8042 and DICOM DIMSE 4242. DICOMweb is under `/dicom-web/`. The official OHIF plugin is configured to use DICOMweb, and GDCM is enabled for JPEG 2000 and other compressed transfer syntaxes.

## Inference service

`backend/inference` is deliberately **fail-closed**. It will not call a generic demo network and label it clinical. Install institution/vendor-approved weights, checksums, preprocessing contract and validation record, then implement the exact approved adapter. Until that happens, the UI displays **unavailable** instead of a made-up ICH or aneurysm probability.

## Data note

The app queries the configured/public QIDO-RS endpoint for CT studies matching HEAD/BRAIN. If no such QIDO study is available, it can load the public de-identified Cornerstone CT volume as a connectivity/rendering fallback, or the user can load a real local head CT DICOM series. No cartoon or procedurally generated brain is substituted.

## Research / regulatory note

This repository is a research prototype and is not a cleared medical device. Clinical deployment requires data governance, cybersecurity review, audit logging, identity/access control, model validation on the intended population and scanner protocols, quality management, and the applicable regulatory pathway.
