import { notFound, redirect } from "next/navigation";

import { StartAssessmentForm } from "@/components/assessment/start-assessment-form";
import { SiteHeader } from "@/components/dashboard/site-header";
import { parseFramework } from "@/lib/frameworks";
import { createClient } from "@/lib/supabase/server";

type StartAssessmentPageProps = {
  params: Promise<{ frameworkId: string }>;
};

export default async function StartAssessmentPage({
  params,
}: StartAssessmentPageProps) {
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(to_bottom,_#020617,_#020617)]">
      <SiteHeader userEmail={user.email} showBack />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <StartAssessmentForm framework={parseFramework(framework)} />
      </main>
    </div>
  );
}
