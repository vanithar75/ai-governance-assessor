-- =============================================================================
-- Migration 002: Latest published version per framework (Phase 2)
-- Run after 001_framework_versions_and_controls.sql
-- =============================================================================

-- Ensure only the latest published version is exposed to the app dashboard.
DROP VIEW IF EXISTS public.frameworks_with_questions CASCADE;
CREATE OR REPLACE VIEW public.frameworks_with_questions
WITH (security_invoker = true)
AS
SELECT
  f.id,
  f.slug,
  f.name,
  f.description,
  f.publisher,
  f.jurisdiction,
  f.website_url,
  fv.id AS framework_version_id,
  fv.version AS framework_version,
  public.build_questions_json(fv.id) AS questions,
  f.created_at,
  f.updated_at
FROM public.frameworks f
JOIN LATERAL (
  SELECT fv_inner.*
  FROM public.framework_versions fv_inner
  WHERE fv_inner.framework_id = f.id
    AND fv_inner.status = 'published'
  ORDER BY
    fv_inner.published_at DESC NULLS LAST,
    fv_inner.created_at DESC
  LIMIT 1
) fv ON true;

GRANT SELECT ON public.frameworks_with_questions TO authenticated;
