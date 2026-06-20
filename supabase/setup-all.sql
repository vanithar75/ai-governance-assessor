-- =============================================================================
-- AI Governance Assessor — complete Supabase setup (paste once in SQL Editor)
-- =============================================================================
--
-- Combines schema.sql (bootstrap) + migrations 001-003 (normalized frameworks, Phase 2 lifecycle, RAG).
-- Safe to re-run. If publish failed with missing jurisdiction column, run this.
--
-- After success: npm run publish-standards
--
-- Alternative: schema.sql then migrations/001_*.sql, 002_phase2_version_lifecycle.sql, 003_phase2_rag_ingestion.sql
-- =============================================================================

-- =============================================================================
-- PART 1: Bootstrap (schema.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE assessment_status AS ENUM (
      'draft',
      'in_progress',
      'completed',
      'archived'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.frameworks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  questions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.frameworks (id) ON DELETE RESTRICT,
  status       assessment_status NOT NULL DEFAULT 'draft',
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  score        INT CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  report       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assessments_user_id
  ON public.assessments (user_id);

CREATE INDEX IF NOT EXISTS idx_assessments_framework_id
  ON public.assessments (framework_id);

CREATE INDEX IF NOT EXISTS idx_assessments_user_status
  ON public.assessments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_assessments_created_at
  ON public.assessments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_frameworks_questions_gin
  ON public.frameworks USING GIN (questions);

CREATE INDEX IF NOT EXISTS idx_assessments_answers_gin
  ON public.assessments USING GIN (answers);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assessments_set_updated_at ON public.assessments;

CREATE TRIGGER assessments_set_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: compliance frameworks
-- ---------------------------------------------------------------------------
INSERT INTO public.frameworks (id, name, description, questions)
VALUES
  (
    'f0000001-0000-4000-8000-000000000001',
    'NIST AI RMF',
    'NIST Artificial Intelligence Risk Management Framework (AI RMF 1.0) — structured around Govern, Map, Measure, and Manage to help organizations identify, assess, and mitigate AI risks throughout the system lifecycle.',
    $nist$
    {
      "version": "1.0",
      "framework": "NIST AI RMF",
      "sections": [
        {
          "id": "govern",
          "title": "Govern",
          "description": "Cultivate a culture of AI risk management and establish policies, processes, and accountability structures.",
          "questions": [
            {
              "id": "gov-01",
              "text": "Does your organization have a documented AI governance policy endorsed by senior leadership?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Policy should define scope, roles, acceptable use, and escalation paths for AI systems."
            },
            {
              "id": "gov-02",
              "text": "Are roles and responsibilities for AI risk management clearly assigned (e.g., risk owner, model owner, legal, ethics)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Map accountability using RACI or equivalent for each AI system in production or development."
            },
            {
              "id": "gov-03",
              "text": "Is there a cross-functional AI risk committee or equivalent body that meets on a defined cadence?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Include representatives from engineering, legal, privacy, security, and business stakeholders."
            },
            {
              "id": "gov-04",
              "text": "Are workforce members who develop or operate AI systems trained on organizational AI policies and risk practices?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["Not at all", "Ad hoc", "Partially", "Mostly", "Fully"],
              "guidance": "Training should cover bias, safety, privacy, and incident reporting."
            },
            {
              "id": "gov-05",
              "text": "Do third-party AI components, APIs, or vendors undergo due diligence before integration?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Review vendor model cards, security posture, data handling, and contractual AI obligations."
            },
            {
              "id": "gov-06",
              "text": "Is there a process to incorporate diverse perspectives (including affected communities) into AI governance decisions?",
              "type": "scale",
              "weight": 2,
              "required": false,
              "options": ["Not at all", "Planned", "Occasionally", "Regularly", "Systematically"],
              "guidance": "Stakeholder engagement reduces blind spots in impact assessment."
            }
          ]
        },
        {
          "id": "map",
          "title": "Map",
          "description": "Establish context to frame risks related to an AI system and its deployment environment.",
          "questions": [
            {
              "id": "map-01",
              "text": "Is the intended purpose, context of use, and target users documented for each AI system?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Document use cases, prohibited uses, and deployment environments."
            },
            {
              "id": "map-02",
              "text": "Have you identified categories of harm the AI system could cause (e.g., safety, privacy, civil rights, reputational)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Consider direct and indirect harms across the full lifecycle including decommissioning."
            },
            {
              "id": "map-03",
              "text": "Is training, validation, and test data documented including provenance, collection methods, and known limitations?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Not documented", "Partially", "Mostly", "Fully", "Auditable"],
              "guidance": "Data documentation supports bias and validity assessments."
            },
            {
              "id": "map-04",
              "text": "Are interdependencies with other systems, humans-in-the-loop, and downstream decision-makers mapped?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Include APIs, orchestration layers, and manual override workflows."
            },
            {
              "id": "map-05",
              "text": "Have you assessed whether the system's outputs could be used in ways beyond the intended purpose (misuse/abuse)?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Document foreseeable misuse scenarios and mitigations."
            },
            {
              "id": "map-06",
              "text": "Is the AI system's trustworthiness profile documented across validity, reliability, safety, security, explainability, privacy, and fairness?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["None", "Some dimensions", "Most dimensions", "All dimensions", "All with evidence"],
              "guidance": "NIST AI RMF characterizes trustworthiness across multiple dimensions."
            }
          ]
        },
        {
          "id": "measure",
          "title": "Measure",
          "description": "Analyze, assess, benchmark, and monitor AI risk and related impacts using quantitative and qualitative methods.",
          "questions": [
            {
              "id": "mea-01",
              "text": "Are model performance metrics defined, measured, and tracked against acceptance thresholds?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Metrics should align with the intended task and include subgroup/disaggregated analysis where applicable."
            },
            {
              "id": "mea-02",
              "text": "Do you conduct bias and fairness evaluations before deployment and on an ongoing basis?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Never", "Pre-deploy only", "Annual", "Quarterly", "Continuous"],
              "guidance": "Evaluate across protected attributes and intersectional groups where legally and ethically appropriate."
            },
            {
              "id": "mea-03",
              "text": "Is there red-teaming, adversarial testing, or robustness evaluation for safety-critical or high-impact systems?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Include prompt injection, data poisoning, and edge-case testing for generative AI."
            },
            {
              "id": "mea-04",
              "text": "Are privacy impacts assessed (e.g., re-identification risk, memorization, data minimization compliance)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Align with applicable privacy regulations and internal data classification policies."
            },
            {
              "id": "mea-05",
              "text": "Is human oversight effectiveness evaluated (override rates, error catch rates, operator feedback)?",
              "type": "scale",
              "weight": 2,
              "required": false,
              "options": ["Not evaluated", "Informal", "Periodic review", "Metrics tracked", "Optimized"],
              "guidance": "Human-AI teaming should be measured, not assumed."
            },
            {
              "id": "mea-06",
              "text": "Are environmental and compute costs tracked for large-scale model training and inference?",
              "type": "yes_no",
              "weight": 1,
              "required": false,
              "guidance": "Sustainability is an emerging governance consideration for foundation models."
            }
          ]
        },
        {
          "id": "manage",
          "title": "Manage",
          "description": "Prioritize and act upon mapped and measured risks to reach acceptable risk levels.",
          "questions": [
            {
              "id": "mgt-01",
              "text": "Is there a risk treatment plan that documents mitigations, residual risk acceptance, and owners?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Link mitigations to specific identified risks and track implementation status."
            },
            {
              "id": "mgt-02",
              "text": "Can high-risk AI systems be paused, rolled back, or decommissioned quickly if harm is detected?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Define kill-switch procedures and communication plans."
            },
            {
              "id": "mgt-03",
              "text": "Is there an AI incident response process integrated with security and privacy incident management?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Cover model drift, harmful outputs, data breaches involving AI pipelines, and regulatory notification."
            },
            {
              "id": "mgt-04",
              "text": "Are model and prompt changes subject to change management with version control and approval gates?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["None", "Informal", "Documented", "Automated gates", "Full MLOps pipeline"],
              "guidance": "Include evaluation requirements before promotion to production."
            },
            {
              "id": "mgt-05",
              "text": "Do you communicate AI limitations and appropriate use to end users and customers?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Transparency materials should be accessible and kept current."
            },
            {
              "id": "mgt-06",
              "text": "Is there a periodic management review of AI risks, metrics, and improvement actions?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["Never", "Ad hoc", "Annual", "Quarterly", "Continuous improvement loop"],
              "guidance": "Feed review outcomes back into Govern and Map activities."
            }
          ]
        }
      ]
    }
    $nist$::jsonb
  ),
  (
    'f0000001-0000-4000-8000-000000000002',
    'EU AI Act',
    'European Union Artificial Intelligence Act — risk-based obligations for AI systems placed on the EU market, covering prohibited practices, high-risk requirements, transparency, and general-purpose AI model rules.',
    $euai$
    {
      "version": "1.0",
      "framework": "EU AI Act",
      "sections": [
        {
          "id": "classification",
          "title": "Risk Classification & Scope",
          "description": "Determine whether your AI system falls under prohibited, high-risk, limited-risk, or minimal-risk categories.",
          "questions": [
            {
              "id": "cls-01",
              "text": "Have you documented whether the AI system is intended to be placed on the EU market or its outputs used in the EU?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Extraterritorial scope applies to providers and deployers affecting persons in the EU."
            },
            {
              "id": "cls-02",
              "text": "Have you assessed whether the system involves any prohibited AI practices (e.g., social scoring, manipulative techniques, biometric categorization)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Prohibited practices must not be developed or deployed; document negative determinations with evidence."
            },
            {
              "id": "cls-03",
              "text": "Is the system listed or equivalent to an Annex III high-risk use case (e.g., employment, credit, law enforcement, critical infrastructure)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Annex III categories trigger conformity assessment and quality management obligations."
            },
            {
              "id": "cls-04",
              "text": "If classified as high-risk, have you assigned the correct provider/deployer/importer/distributor role under the Act?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Obligations differ by actor in the value chain."
            },
            {
              "id": "cls-05",
              "text": "For limited-risk systems (e.g., chatbots, emotion recognition, deepfakes), are transparency obligations identified?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Users must be informed they are interacting with AI or exposed to synthetic content where required."
            },
            {
              "id": "cls-06",
              "text": "Is there a documented legal basis and DPIA (where applicable) for processing personal data in the AI system?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "AI Act obligations complement GDPR; high-risk systems often require DPIAs."
            }
          ]
        },
        {
          "id": "high_risk",
          "title": "High-Risk System Requirements",
          "description": "Core obligations for high-risk AI systems under Chapter 2 (risk management, data, documentation, transparency, human oversight, accuracy, cybersecurity).",
          "questions": [
            {
              "id": "hr-01",
              "text": "Is a risk management system established and maintained throughout the AI system lifecycle?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Identify and evaluate known and reasonably foreseeable risks to health, safety, and fundamental rights."
            },
            {
              "id": "hr-02",
              "text": "Are data governance practices in place ensuring training, validation, and testing datasets are relevant, representative, and free of errors to the extent possible?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Not in place", "Partial", "Documented", "Validated", "Continuously monitored"],
              "guidance": "Examine potential biases and gaps that could affect fundamental rights."
            },
            {
              "id": "hr-03",
              "text": "Is technical documentation prepared per Annex IV requirements before market placement?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Documentation must be kept up to date and available to authorities upon request."
            },
            {
              "id": "hr-04",
              "text": "Does the system achieve appropriate levels of accuracy, robustness, and cybersecurity?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Not assessed", "Basic testing", "Documented benchmarks", "Independently verified", "Certified/audited"],
              "guidance": "Include resilience against adversarial attacks and unauthorized modifications."
            },
            {
              "id": "hr-05",
              "text": "Is effective human oversight designed into the system per Article 14 requirements?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Oversight measures must enable understanding, monitoring, and intervention or interruption."
            },
            {
              "id": "hr-06",
              "text": "Is automatic logging of events (logs) enabled and retained for traceability of system operation?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Logs support post-market monitoring and serious incident investigation."
            }
          ]
        },
        {
          "id": "gpai",
          "title": "General-Purpose AI (GPAI) Models",
          "description": "Obligations for providers of general-purpose AI models and systemic risk models.",
          "questions": [
            {
              "id": "gpai-01",
              "text": "If you provide a GPAI model, have you prepared and published a model card / technical documentation per Annex XI?",
              "type": "yes_no",
              "weight": 3,
              "required": false,
              "guidance": "Applies when placing GPAI models on the EU market. Mark N/A if not a GPAI provider."
            },
            {
              "id": "gpai-02",
              "text": "Is a copyright compliance policy implemented for training data (including rights reservation mechanisms)?",
              "type": "yes_no",
              "weight": 2,
              "required": false,
              "guidance": "Providers must make a policy available detailing compliance with Union copyright law."
            },
            {
              "id": "gpai-03",
              "text": "For GPAI models with systemic risk, are model evaluations, adversarial testing, and incident reporting processes in place?",
              "type": "scale",
              "weight": 3,
              "required": false,
              "options": ["N/A", "Not started", "In progress", "Operational", "Externally audited"],
              "guidance": "Systemic risk models face additional obligations under Chapter V."
            },
            {
              "id": "gpai-04",
              "text": "Do downstream deployers receive sufficient information to comply with their obligations when using your GPAI model?",
              "type": "yes_no",
              "weight": 2,
              "required": false,
              "guidance": "Supply documentation on capabilities, limitations, and recommended use."
            }
          ]
        },
        {
          "id": "post_market",
          "title": "Post-Market Monitoring & Incident Reporting",
          "description": "Ongoing obligations after an AI system is placed on the market.",
          "questions": [
            {
              "id": "pm-01",
              "text": "Is a post-market monitoring plan established and implemented per Article 72?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Collect and analyze performance data to detect need for corrective action."
            },
            {
              "id": "pm-02",
              "text": "Is there a process to report serious incidents to market surveillance authorities without undue delay?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Define what constitutes a serious incident for your use case and escalation timelines."
            },
            {
              "id": "pm-03",
              "text": "Can you execute corrective actions (updates, recalls, withdrawals) when the system no longer conforms?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Document decision criteria and communication to deployers/users."
            },
            {
              "id": "pm-04",
              "text": "Is CE marking / EU declaration of conformity prepared where required for high-risk systems?",
              "type": "yes_no",
              "weight": 3,
              "required": false,
              "guidance": "Required before placing high-risk AI systems on the EU market."
            },
            {
              "id": "pm-05",
              "text": "Are records retained for at least 10 years as required for high-risk AI providers?",
              "type": "yes_no",
              "weight": 2,
              "required": false,
              "guidance": "Include documentation, conformity assessment, and monitoring records."
            }
          ]
        }
      ]
    }
    $euai$::jsonb
  ),
  (
    'f0000001-0000-4000-8000-000000000003',
    'ISO/IEC 42001',
    'ISO/IEC 42001:2023 — Artificial Intelligence Management System (AIMS) standard specifying requirements to establish, implement, maintain, and continually improve responsible AI management within organizations.',
    $iso$
    {
      "version": "1.0",
      "framework": "ISO/IEC 42001",
      "sections": [
        {
          "id": "context",
          "title": "Context of the Organization (Clause 4)",
          "description": "Understand internal and external issues, interested parties, and AIMS scope.",
          "questions": [
            {
              "id": "ctx-01",
              "text": "Have internal and external issues relevant to AI management objectives been identified and reviewed?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Consider technology trends, regulation, ethics, supply chain, and organizational culture."
            },
            {
              "id": "ctx-02",
              "text": "Are interested parties and their requirements related to responsible AI documented?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Include regulators, customers, employees, affected communities, and partners."
            },
            {
              "id": "ctx-03",
              "text": "Is the scope of the AI Management System (AIMS) defined, documented, and communicated?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Scope should state boundaries, applicability, and exclusions with justification."
            },
            {
              "id": "ctx-04",
              "text": "Is there an inventory of AI systems within the AIMS scope?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["None", "Partial list", "Maintained inventory", "With risk tiers", "Integrated with CMDB"],
              "guidance": "Inventory supports lifecycle management and impact assessment."
            }
          ]
        },
        {
          "id": "leadership",
          "title": "Leadership (Clause 5)",
          "description": "Top management commitment, AI policy, and organizational roles.",
          "questions": [
            {
              "id": "ldr-01",
              "text": "Has top management demonstrated leadership and commitment to the AIMS?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Evidence includes resource allocation, policy approval, and management reviews."
            },
            {
              "id": "ldr-02",
              "text": "Is there a documented AI policy aligned with organizational strategy and legal/ethical requirements?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Policy should include commitments to continual improvement and responsible AI principles."
            },
            {
              "id": "ldr-03",
              "text": "Are roles, responsibilities, and authorities for AIMS conformance assigned and communicated?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Include an AI management representative or equivalent accountability structure."
            },
            {
              "id": "ldr-04",
              "text": "Are AI objectives established at relevant functions and levels, measured, and reviewed?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["None", "Informal goals", "Documented objectives", "Tracked KPIs", "Aligned to strategy"],
              "guidance": "Objectives should be consistent, measurable, and updated during management review."
            }
          ]
        },
        {
          "id": "planning",
          "title": "Planning (Clause 6)",
          "description": "Risk and opportunity management, AI impact assessment, and planning of changes.",
          "questions": [
            {
              "id": "pln-01",
              "text": "Is there a documented process for AI risk assessment and treatment integrated with organizational risk management?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Align with ISO/IEC 23894 guidance on AI risk management where applicable."
            },
            {
              "id": "pln-02",
              "text": "Are AI system impact assessments conducted to evaluate consequences for individuals and society?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Never", "High-risk only", "Most systems", "All in scope", "With stakeholder input"],
              "guidance": "Impact assessments inform design, deployment, and monitoring controls."
            },
            {
              "id": "pln-03",
              "text": "Are legal, regulatory, and contractual requirements related to AI identified and kept current?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Maintain a compliance register mapped to AI systems and jurisdictions."
            },
            {
              "id": "pln-04",
              "text": "Are changes to the AIMS or AI systems planned with impact analysis and approved controls?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Include re-assessment triggers for model updates, new data sources, and use case changes."
            }
          ]
        },
        {
          "id": "support",
          "title": "Support (Clause 7)",
          "description": "Resources, competence, awareness, communication, and documented information.",
          "questions": [
            {
              "id": "sup-01",
              "text": "Are adequate resources allocated for establishing and maintaining the AIMS?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Include budget, tooling, expertise, and infrastructure for responsible AI."
            },
            {
              "id": "sup-02",
              "text": "Is competence for personnel affecting AI performance and compliance determined, ensured, and recorded?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Not addressed", "Ad hoc training", "Role-based curriculum", "Assessed competence", "Certified roles"],
              "guidance": "Cover ethics, security, data science, legal, and domain expertise as appropriate."
            },
            {
              "id": "sup-03",
              "text": "Do personnel understand their contribution to effective AIMS and implications of nonconformity?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Awareness programs should be periodic and updated when policies change."
            },
            {
              "id": "sup-04",
              "text": "Is documented information required by the AIMS controlled (versioning, access, retention)?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Apply document control consistent with ISO management system practices."
            }
          ]
        },
        {
          "id": "operation",
          "title": "Operation (Clause 8)",
          "description": "Operational planning, AI risk treatment, data management, and lifecycle controls.",
          "questions": [
            {
              "id": "ops-01",
              "text": "Are operational controls implemented for AI development, deployment, and monitoring per the risk treatment plan?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Controls may include access management, evaluation gates, and logging."
            },
            {
              "id": "ops-02",
              "text": "Is data for AI systems managed throughout its lifecycle (quality, provenance, privacy, security)?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["Minimal", "Basic policies", "Documented lifecycle", "Automated quality checks", "Auditable lineage"],
              "guidance": "Reference ISO/IEC 5259 data quality characteristics where helpful."
            },
            {
              "id": "ops-03",
              "text": "Are suppliers and partners providing AI-related products or services evaluated and monitored?",
              "type": "yes_no",
              "weight": 2,
              "required": true,
              "guidance": "Include cloud AI APIs, labeled data vendors, and outsourced model development."
            },
            {
              "id": "ops-04",
              "text": "Is there a defined process for responsible design, development, and deployment of AI systems?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Embed requirements for fairness, transparency, robustness, and human oversight in SDLC."
            }
          ]
        },
        {
          "id": "performance",
          "title": "Performance Evaluation (Clause 9)",
          "description": "Monitoring, measurement, internal audit, and management review.",
          "questions": [
            {
              "id": "perf-01",
              "text": "Are AIMS performance indicators monitored, measured, analyzed, and evaluated?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Track leading and lagging indicators for AI risks and objectives."
            },
            {
              "id": "perf-02",
              "text": "Is an internal audit program conducted at planned intervals for the AIMS?",
              "type": "scale",
              "weight": 3,
              "required": true,
              "options": ["None", "Planned", "Annual audits", "Risk-based program", "Independent audits"],
              "guidance": "Auditors should be objective and competent in AI management systems."
            },
            {
              "id": "perf-03",
              "text": "Does top management review the AIMS at planned intervals covering status, changes, and improvement opportunities?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Management review inputs include audit results, incidents, and stakeholder feedback."
            },
            {
              "id": "perf-04",
              "text": "Are customer and user feedback channels used to evaluate AI system performance and trust?",
              "type": "yes_no",
              "weight": 2,
              "required": false,
              "guidance": "Complaints and feedback inform corrective action and continual improvement."
            }
          ]
        },
        {
          "id": "improvement",
          "title": "Improvement (Clause 10)",
          "description": "Nonconformity, corrective action, and continual improvement.",
          "questions": [
            {
              "id": "imp-01",
              "text": "Is there a process to identify, document, and react to nonconformities (including AI-related incidents)?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Integrate with incident management and regulatory reporting where required."
            },
            {
              "id": "imp-02",
              "text": "Are root cause analyses performed and corrective actions implemented to prevent recurrence?",
              "type": "yes_no",
              "weight": 3,
              "required": true,
              "guidance": "Verify effectiveness of corrective actions before closing records."
            },
            {
              "id": "imp-03",
              "text": "Does the organization demonstrate continual improvement of the AIMS suitability, adequacy, and effectiveness?",
              "type": "scale",
              "weight": 2,
              "required": true,
              "options": ["Reactive only", "Occasional", "Planned cycles", "Measured improvement", "Culture of improvement"],
              "guidance": "Use audit findings, metrics trends, and lessons learned to drive improvement."
            }
          ]
        }
      ]
    }
    $iso$::jsonb
  )
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  questions   = EXCLUDED.questions;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Frameworks are reference data: any authenticated user may read.
DROP POLICY IF EXISTS "Authenticated users can read frameworks" ON public.frameworks;

CREATE POLICY "Authenticated users can read frameworks"
  ON public.frameworks
  FOR SELECT
  TO authenticated
  USING (true);

-- Assessments: users fully manage only their own rows.
DROP POLICY IF EXISTS "Users can view own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can create own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can update own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can delete own assessments" ON public.assessments;

CREATE POLICY "Users can view own assessments"
  ON public.assessments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assessments"
  ON public.assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments"
  ON public.assessments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments"
  ON public.assessments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants (Supabase authenticated role)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.frameworks TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;

GRANT USAGE ON TYPE assessment_status TO authenticated;

-- ---------------------------------------------------------------------------
-- Optional: helper view for assessments with framework metadata
-- (Replaced in PART 2 with version-aware columns; drop allows column changes.)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.assessments_with_framework CASCADE;
CREATE OR REPLACE VIEW public.assessments_with_framework
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.user_id,
  a.framework_id,
  f.name AS framework_name,
  f.description AS framework_description,
  a.status,
  a.answers,
  a.score,
  a.report,
  a.created_at,
  a.updated_at
FROM public.assessments AS a
JOIN public.frameworks AS f ON f.id = a.framework_id;

GRANT SELECT ON public.assessments_with_framework TO authenticated;


-- =============================================================================
-- PART 2: Normalized schema (migration 001)
-- =============================================================================

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

-- Updated assessments view (drops PART 1 definition so columns can change)
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

-- =============================================================================
-- PART 3: Phase 2 version lifecycle (migration 002)
-- =============================================================================
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


-- =============================================================================
-- PART 4: RAG source documents and chunks (migration 003)
-- =============================================================================
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

-- =============================================================================
-- PART 4: RFP Customer Assessment Mode (migration 004)
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

