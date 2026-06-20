-- =============================================================================
-- AI Governance Assessor — Supabase bootstrap (schema, seed data, RLS)
-- =============================================================================
--
-- RECOMMENDED (one paste): run supabase/setup-all.sql in the SQL Editor.
--   Includes this bootstrap + migration 001 (jurisdiction, slug, versions, controls).
--   Safe to re-run if you already applied only this file.
--
-- TWO-STEP (alternative):
--   1. Paste and run this file (schema.sql) once.
--   2. Paste and run supabase/migrations/001_framework_versions_and_controls.sql
--
-- After the database has migration 001 applied, publish Git-managed standards:
--   npm run publish-standards
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
-- ---------------------------------------------------------------------------
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
