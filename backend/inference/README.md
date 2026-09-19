# Validation-gated ICH / aneurysm inference service

This service is deliberately fail-closed. It does **not** ship invented or unvalidated diagnostic weights.

To enable clinical-result passthrough, install an organization-approved model package at `/app/model_registry/manifest.json`, include SHA-256 hashes for every weight, set `validationStatus` to `VALIDATED_FOR_DEPLOYMENT` only after your documented validation/review process, and provide the exact approved preprocessing/inference adapter through `VALIDATED_ADAPTER`.

The web UI treats any missing, research-only, malformed, or untraceable response as unavailable. This prevents a demo model from being presented as a validated ICH/aneurysm detector.
