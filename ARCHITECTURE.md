# Architecture

```text
Browser / Vercel
┌────────────────────────────────────────────────────────────────────┐
│ React UI                                                          │
│  ├─ Cornerstone3D rendering engine                                │
│  │   ├─ Axial / Coronal / Sagittal MPR                           │
│  │   └─ 3D volume raycasting / MIP / transfer functions          │
│  ├─ Cornerstone Tools                                             │
│  └─ DICOM Image Loader -> Web Workers + compressed DICOM codecs   │
│                                                                    │
│ /api/dicomweb ───────────────► Orthanc / hospital DICOMweb         │
│       QIDO-RS / WADO-RS         ├─ DICOMweb plugin                │
│                                  ├─ GDCM plugin                    │
│                                  └─ OHIF plugin                    │
│                                                                    │
│ /api/inference ──────────────► Validation-gated model service      │
│                                  ├─ manifest + checksum gate       │
│                                  ├─ approved preprocessing adapter │
│                                  └─ ICH / aneurysm output contract │
└────────────────────────────────────────────────────────────────────┘
```

The Vercel function acts as a same-origin DICOMweb gateway. The upstream host is configured server-side and cannot be selected by a browser request, avoiding an open SSRF proxy. DICOM pixel data remains DICOM; the frontend volume is generated from actual decoded frames.
