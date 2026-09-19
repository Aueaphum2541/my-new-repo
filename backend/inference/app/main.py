from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(title="NEURO-SYNAPSE Validation-Gated Inference", version="1.0.0")
REGISTRY = Path(os.getenv("MODEL_REGISTRY", "/app/model_registry"))
MANIFEST = REGISTRY / "manifest.json"


class Finding(BaseModel):
    probability: float = Field(ge=0, le=1)
    finding: Literal["positive", "negative", "indeterminate"]
    volumeMl: Optional[float] = Field(default=None, ge=0)
    maxHu: Optional[float] = None
    maxDiameterMm: Optional[float] = Field(default=None, ge=0)
    stenosisPercent: Optional[float] = Field(default=None, ge=0, le=100)


class AnalysisResult(BaseModel):
    status: Literal["validated"] = "validated"
    modelVersion: str
    validationId: str
    ich: Optional[Finding] = None
    aneurysm: Optional[Finding] = None
    midlineShiftMm: Optional[float] = Field(default=None, ge=0)
    message: str


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validated_manifest() -> dict:
    if not MANIFEST.exists():
        raise HTTPException(503, "No approved model package is installed. Predictions are disabled.")
    try:
        manifest = json.loads(MANIFEST.read_text())
    except Exception as exc:
        raise HTTPException(503, f"Model manifest is unreadable: {exc}")
    if manifest.get("validationStatus") != "VALIDATED_FOR_DEPLOYMENT":
        raise HTTPException(503, "Model package has not passed the deployment validation gate.")
    if not manifest.get("validationId") or not manifest.get("modelVersion"):
        raise HTTPException(503, "Validation traceability fields are missing.")
    for name, entry in (manifest.get("weights") or {}).items():
        p = REGISTRY / entry.get("path", "")
        expected = str(entry.get("sha256", "")).lower()
        if not p.is_file() or len(expected) != 64 or sha256(p).lower() != expected:
            raise HTTPException(503, f"Checksum validation failed for {name} model weight.")
    return manifest


@app.get("/health")
def health():
    try:
        manifest = validated_manifest()
        return {
            "status": "ready",
            "modelVersion": manifest["modelVersion"],
            "validationId": manifest["validationId"],
        }
    except HTTPException as exc:
        return {"status": "locked", "reason": exc.detail}


@app.get("/v1/model-card")
def model_card():
    manifest = validated_manifest()
    safe = dict(manifest)
    safe.pop("weights", None)
    return safe


@app.get("/v1/analyze", response_model=AnalysisResult)
def analyze(
    studyInstanceUID: str = Query(min_length=8),
    seriesInstanceUID: str = Query(min_length=8),
):
    manifest = validated_manifest()

    # This service intentionally does not invent clinical scores. A production installation
    # must supply a versioned, validation-approved preprocessing + inference adapter for the
    # exact approved weights. Connect that adapter here (or route to a regulated vendor API).
    # Until that implementation is installed, the service remains hard-locked rather than
    # returning plausible-looking but unvalidated ICH/aneurysm outputs.
    adapter = os.getenv("VALIDATED_ADAPTER")
    if not adapter:
        raise HTTPException(
            503,
            "Validated model package is present, but no approved inference adapter is configured. Predictions remain disabled.",
        )

    raise HTTPException(
        501,
        "Install the organization-approved inference adapter named by VALIDATED_ADAPTER. Generic ONNX inference is not substituted for a validated clinical pipeline.",
    )
