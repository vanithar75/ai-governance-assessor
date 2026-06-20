-- =============================================================================
-- Quick fix: recreate views after column-structure changes
-- =============================================================================
-- Run this in Supabase SQL Editor if setup-all.sql or migration 001 failed with:
--   ERROR 42P16: cannot change name of view column "framework_name" to "framework_version_id"
--
-- Requires: framework_versions, controls, frameworks, assessments tables and
--           public.build_questions_json() from migration 001 already exist.
-- Safe to re-run.
-- =============================================================================

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
JOIN public.framework_versions fv ON fv.framework_id = f.id
WHERE fv.status = 'published';

DROP VIEW IF EXISTS public.framework_versions_with_questions CASCADE;
CREATE OR REPLACE VIEW public.framework_versions_with_questions
WITH (security_invoker = true)
AS
SELECT
  f.id AS framework_id,
  f.slug,
  f.name,
  f.description,
  f.publisher,
  f.jurisdiction,
  f.website_url,
  fv.id AS framework_version_id,
  fv.version AS framework_version,
  fv.status,
  fv.changelog,
  fv.published_at,
  public.build_questions_json(fv.id) AS questions,
  fv.created_at,
  fv.updated_at
FROM public.framework_versions fv
JOIN public.frameworks f ON f.id = fv.framework_id;

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

GRANT SELECT ON public.frameworks_with_questions TO authenticated;
GRANT SELECT ON public.framework_versions_with_questions TO authenticated;
GRANT SELECT ON public.assessments_with_framework TO authenticated;
