-- =============================================================================
-- Migration 001: Normalized frameworks, versions, controls, and mappings
-- Run after the initial schema.sql bootstrap (or on a fresh project).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_version_status') THEN
    CREATE TYPE framework_version_status AS ENUM ('draft', 'published', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE question_type AS ENUM ('yes_no', 'scale', 'text');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'control_severity') THEN
    CREATE TYPE control_severity AS ENUM (
      'critical',
      'high',
      'medium',
      'low',
      'informational'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'control_mapping_type') THEN
    CREATE TYPE control_mapping_type AS ENUM (
      'equivalent',
      'partial',
      'related',
      'supersedes'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Evolve frameworks table (metadata only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.frameworks
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS publisher TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill slug from name for existing rows
UPDATE public.frameworks
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

UPDATE public.frameworks SET slug = 'nist-ai-rmf' WHERE name = 'NIST AI RMF' AND slug IS DISTINCT FROM 'nist-ai-rmf';
UPDATE public.frameworks SET slug = 'eu-ai-act' WHERE name = 'EU AI Act' AND slug IS DISTINCT FROM 'eu-ai-act';
UPDATE public.frameworks SET slug = 'iso-42001' WHERE name = 'ISO/IEC 42001' AND slug IS DISTINCT FROM 'iso-42001';

UPDATE public.frameworks SET publisher = 'NIST', jurisdiction = 'US' WHERE name = 'NIST AI RMF';
UPDATE public.frameworks SET publisher = 'European Commission', jurisdiction = 'EU' WHERE name = 'EU AI Act';
UPDATE public.frameworks SET publisher = 'ISO/IEC', jurisdiction = 'International' WHERE name = 'ISO/IEC 42001';

ALTER TABLE public.frameworks
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_frameworks_slug ON public.frameworks (slug);

DROP TRIGGER IF EXISTS frameworks_set_updated_at ON public.frameworks;
CREATE TRIGGER frameworks_set_updated_at
  BEFORE UPDATE ON public.frameworks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- framework_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id  UUID NOT NULL REFERENCES public.frameworks (id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  status        framework_version_status NOT NULL DEFAULT 'draft',
  changelog     TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, version)
);

CREATE INDEX IF NOT EXISTS idx_framework_versions_framework_id
  ON public.framework_versions (framework_id);

CREATE INDEX IF NOT EXISTS idx_framework_versions_status
  ON public.framework_versions (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_versions_one_published
  ON public.framework_versions (framework_id)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS framework_versions_set_updated_at ON public.framework_versions;
CREATE TRIGGER framework_versions_set_updated_at
  BEFORE UPDATE ON public.framework_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- controls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.controls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_version_id UUID NOT NULL REFERENCES public.framework_versions (id) ON DELETE CASCADE,
  control_id           TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  category             TEXT NOT NULL,
  category_title       TEXT,
  category_description TEXT,
  severity             control_severity NOT NULL DEFAULT 'medium',
  question_type        question_type NOT NULL,
  options              JSONB NOT NULL DEFAULT '[]'::jsonb,
  weight               INT NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 10),
  guidance             TEXT,
  required             BOOLEAN NOT NULL DEFAULT true,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_version_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_controls_framework_version_id
  ON public.controls (framework_version_id);

CREATE INDEX IF NOT EXISTS idx_controls_category
  ON public.controls (framework_version_id, category, sort_order);

-- ---------------------------------------------------------------------------
-- control_mappings (crosswalk)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.control_mappings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_control_id  UUID NOT NULL REFERENCES public.controls (id) ON DELETE CASCADE,
  target_control_id  UUID NOT NULL REFERENCES public.controls (id) ON DELETE CASCADE,
  mapping_type       control_mapping_type NOT NULL DEFAULT 'related',
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_control_id <> target_control_id),
  UNIQUE (source_control_id, target_control_id)
);

CREATE INDEX IF NOT EXISTS idx_control_mappings_source
  ON public.control_mappings (source_control_id);

CREATE INDEX IF NOT EXISTS idx_control_mappings_target
  ON public.control_mappings (target_control_id);

-- ---------------------------------------------------------------------------
-- Pin assessments to a specific framework version
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS framework_version_id UUID
    REFERENCES public.framework_versions (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_assessments_framework_version_id
  ON public.assessments (framework_version_id);

-- ---------------------------------------------------------------------------
-- Migrate existing JSONB questions → normalized rows
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fw RECORD;
  fv_id UUID;
  section JSONB;
  question JSONB;
  sort_idx INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'frameworks'
      AND column_name = 'questions'
  ) THEN
    RETURN;
  END IF;

  FOR fw IN
    SELECT id, name, questions
    FROM public.frameworks
    WHERE questions IS NOT NULL AND questions <> '[]'::jsonb
  LOOP
    SELECT id INTO fv_id
    FROM public.framework_versions
    WHERE framework_id = fw.id
      AND version = COALESCE(fw.questions->>'version', '1.0');

    IF fv_id IS NULL THEN
      INSERT INTO public.framework_versions (
        framework_id, version, status, changelog, published_at
      )
      VALUES (
        fw.id,
        COALESCE(fw.questions->>'version', '1.0'),
        'published',
        'Migrated from legacy frameworks.questions JSONB column.',
        now()
      )
      RETURNING id INTO fv_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.controls WHERE framework_version_id = fv_id) THEN
      CONTINUE;
    END IF;

    sort_idx := 0;
    FOR section IN SELECT * FROM jsonb_array_elements(fw.questions->'sections')
    LOOP
      FOR question IN SELECT * FROM jsonb_array_elements(section->'questions')
      LOOP
        sort_idx := sort_idx + 1;
        INSERT INTO public.controls (
          framework_version_id,
          control_id,
          title,
          category,
          category_title,
          category_description,
          question_type,
          options,
          weight,
          guidance,
          required,
          sort_order
        )
        VALUES (
          fv_id,
          question->>'id',
          question->>'text',
          section->>'id',
          section->>'title',
          section->>'description',
          (question->>'type')::question_type,
          COALESCE(question->'options', '[]'::jsonb),
          COALESCE((question->>'weight')::INT, 1),
          question->>'guidance',
          COALESCE((question->>'required')::BOOLEAN, true),
          sort_idx
        )
        ON CONFLICT (framework_version_id, control_id) DO NOTHING;
      END LOOP;
    END LOOP;

    UPDATE public.assessments
    SET framework_version_id = fv_id
    WHERE framework_id = fw.id
      AND framework_version_id IS NULL;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Helper: build legacy questions JSONB from controls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_questions_json(p_version_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH sections AS (
    SELECT DISTINCT ON (category)
      category AS id,
      category_title AS title,
      category_description AS description,
      MIN(sort_order) AS min_sort
    FROM public.controls
    WHERE framework_version_id = p_version_id
    GROUP BY category, category_title, category_description
    ORDER BY category, MIN(sort_order)
  ),
  section_questions AS (
    SELECT
      s.id AS section_id,
      s.title,
      s.description,
      s.min_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', c.control_id,
          'text', c.title,
          'type', c.question_type,
          'weight', c.weight,
          'required', c.required,
          'guidance', c.guidance,
          'options', CASE
            WHEN jsonb_array_length(c.options) > 0 THEN c.options
            ELSE NULL
          END
        )
        ORDER BY c.sort_order
      ) AS questions
    FROM sections s
    JOIN public.controls c
      ON c.framework_version_id = p_version_id
     AND c.category = s.id
    GROUP BY s.id, s.title, s.description, s.min_sort
  )
  SELECT jsonb_build_object(
    'version', fv.version,
    'framework', f.name,
    'sections', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sq.section_id,
            'title', sq.title,
            'description', sq.description,
            'questions', sq.questions
          )
          ORDER BY sq.min_sort
        )
        FROM section_questions sq
      ),
      '[]'::jsonb
    )
  )
  FROM public.framework_versions fv
  JOIN public.frameworks f ON f.id = fv.framework_id
  WHERE fv.id = p_version_id;
$$;

-- ---------------------------------------------------------------------------
-- Backward-compat view: latest published version per framework
-- ---------------------------------------------------------------------------
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

-- View for a specific version (used when assessments pin to a version)
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

-- Updated assessments view
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
  a.created_at,
  a.updated_at
FROM public.assessments AS a
JOIN public.frameworks AS f ON f.id = a.framework_id
LEFT JOIN public.framework_versions AS fv ON fv.id = a.framework_version_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.framework_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read published framework versions"
  ON public.framework_versions;
CREATE POLICY "Authenticated users can read published framework versions"
  ON public.framework_versions
  FOR SELECT
  TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can read controls of published versions"
  ON public.controls;
CREATE POLICY "Authenticated users can read controls of published versions"
  ON public.controls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.framework_versions fv
      WHERE fv.id = controls.framework_version_id
        AND fv.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read control mappings"
  ON public.control_mappings;
CREATE POLICY "Authenticated users can read control mappings"
  ON public.control_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role bypasses RLS for publish pipeline (uses service role key).

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.framework_versions TO authenticated;
GRANT SELECT ON public.controls TO authenticated;
GRANT SELECT ON public.control_mappings TO authenticated;
GRANT SELECT ON public.frameworks_with_questions TO authenticated;
GRANT SELECT ON public.framework_versions_with_questions TO authenticated;
GRANT SELECT ON public.assessments_with_framework TO authenticated;

GRANT USAGE ON TYPE framework_version_status TO authenticated;
GRANT USAGE ON TYPE question_type TO authenticated;
GRANT USAGE ON TYPE control_severity TO authenticated;
GRANT USAGE ON TYPE control_mapping_type TO authenticated;
