# SPHEREx Explorer - Frontend Ground Rules

1. The frontend never calls NASA or IRSA directly. All data comes from the FastAPI backend through src/api.

2. Types come from the generated OpenAPI file (src/api/schema.d.ts). Never invent fields or rename endpoints.

3. If a field or endpoint is missing, stop and ask; do not guess.

4. Never fabricate scientific values. Missing data stays null and is shown as a gap.

5. All mock data is labelled DEMO DATA in the UI. Never present mock data as NASA observations.

6. Candidates are called Potential detections, never Discoveries.

7. Components never call fetch. They use hooks from src/api.

8. Pixel coordinates are 0-based, origin at the top-left of the delivered image, y downward.

9. RA/Dec are ICRS decimal degrees. Time is ISO 8601 UTC plus MJD. Flux units come from flux_unit fields.

10. Strict TypeScript, no any. Every new feature needs tests and loading, empty, error states.
