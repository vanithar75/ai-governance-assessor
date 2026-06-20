-- =============================================================================
-- Migration 003: RAG source documents and chunks (Phase 2)
-- Run after 002_phase2_version_lifecycle.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- source_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_slug TEXT NOT NULL,
  title          TEXT NOT NULL,
  source_url     TEXT,
  content_hash   TEXT NOT NULL,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_slug, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_framework_slug
  ON public.source_documents (framework_slug);

-- ---------------------------------------------------------------------------
-- document_chunks (pgvector when available; embedding nullable for MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES public.source_documents (id) ON DELETE CASCADE,
  chunk_index        INT NOT NULL,
  content            TEXT NOT NULL,
  embedding          vector(1536),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_source_document_id
  ON public.document_chunks (source_document_id);

-- Optional: add ivfflat index after embeddings are populated:
-- CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
--   WHERE embedding IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read source documents"
  ON public.source_documents;
CREATE POLICY "Authenticated users can read source documents"
  ON public.source_documents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read document chunks"
  ON public.document_chunks;
CREATE POLICY "Authenticated users can read document chunks"
  ON public.document_chunks
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.source_documents TO authenticated;
GRANT SELECT ON public.document_chunks TO authenticated;
