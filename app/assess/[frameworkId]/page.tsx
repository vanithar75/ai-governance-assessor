import { notFound, redirect } from "next/navigation";

import { ComplianceQuestionnaire } from "@/components/assessment/compliance-questionnaire";
import { SiteHeader } from "@/components/dashboard/site-header";
import { getAssessmentDraft } from "@/app/actions/assessments";
import { parseFramework } from "@/lib/frameworks";
import { createClient } from "@/lib/supabase/server";

type AssessPageProps = {
  params: Promise<{ frameworkId: string }>;
};

export default async function AssessPage({ params }: AssessPageProps) {
  const { frameworkId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: framework, error } = await supabase
    .from("frameworks_with_questions")
    .select(
      "id, slug, name, description, questions, framework_version_id, framework_version, created_at",
    )
    .eq("id", frameworkId)
    .single();

  if (error || !framework) {
    notFound();
  }

  const parsedFramework = parseFramework(framework);
  const { draft } = await getAssessmentDraft(
    parsedFramework.id,
    parsedFramework.framework_version_id,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(to_bottom,_#020617,_#020617)]">
      <SiteHeader userEmail={user.email} showBack />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <ComplianceQuestionnaire
          framework={parsedFramework}
          initialDraft={draft}
        />
      </main>
    </div>
  );
}
