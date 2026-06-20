-- =============================================================================
-- Migration 004: RFP Customer Assessment Mode (Sprint 3)
-- Run after migrations 001-003
-- Safe to re-run
-- =============================================================================

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_mode TEXT NOT NULL DEFAULT 'internal'
    CHECK (assessment_mode IN ('internal', 'customer'));

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS customer_profile JSONB;

COMMENT ON COLUMN public.assessments.assessment_mode IS
  'internal = presales self-assessment; customer = RFP-facing assessment';

COMMENT ON COLUMN public.assessments.customer_profile IS
  'Customer context for RFP mode: companyName, rfpReference, industry, contactEmail?';

CREATE INDEX IF NOT EXISTS idx_assessments_assessment_mode
  ON public.assessments (assessment_mode);

-- Recreate view to expose new columns (existing RLS on assessments covers them)
DROP VIEW IF EXISTS public.assessments_with_framework CASCADE;
CREATE OR REPLACE VIEW public.assessments_with_framework
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.user_id,
  a.framework_id,
  a.framework_version_id,
  f.name AS framework_name,
  f.description AS framework_description,
  fv.version AS framework_version,
  a.status,
  a.answers,
  a.score,
  a.report,
  a.assessment_mode,
  a.customer_profile,
  a.created_at,
  a.updated_at
FROM public.assessments AS a
JOIN public.frameworks AS f ON f.id = a.framework_id
LEFT JOIN public.framework_versions AS fv ON fv.id = a.framework_version_id;

GRANT SELECT ON public.assessments_with_framework TO authenticated;
