-- =============================================================================
-- Supabase Storage: assessment evidence attachments (Phase 1)
-- =============================================================================
-- Run in Supabase SQL Editor after schema + migration 001.
-- Free tier: 1 GB storage — sufficient for PDF/image evidence per question.
-- Private bucket; clients use signed URLs for download/preview.
-- Path convention: {user_id}/{assessment_id}/{filename}
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-evidence',
  'assessment-evidence',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- One active draft per user + framework version (assessment drafts)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_one_active_draft
  ON public.assessments (user_id, framework_version_id)
  WHERE status IN ('draft', 'in_progress')
    AND framework_version_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_one_active_draft_no_version
  ON public.assessments (user_id, framework_id)
  WHERE status IN ('draft', 'in_progress')
    AND framework_version_id IS NULL;

-- ---------------------------------------------------------------------------
-- Storage RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users upload own assessment evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users read own assessment evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users update own assessment evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own assessment evidence" ON storage.objects;

CREATE POLICY "Users upload own assessment evidence"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assessment-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own assessment evidence"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assessment-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own assessment evidence"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'assessment-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'assessment-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own assessment evidence"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assessment-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
