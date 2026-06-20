import { AuthPanel } from "@/components/auth/auth-panel";
import { FrameworkGrid } from "@/components/dashboard/framework-grid";
import { SiteHeader } from "@/components/dashboard/site-header";
import { parseFramework } from "@/lib/frameworks";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%),linear-gradient(to_bottom,_#020617,_#020617)]">
        <SiteHeader />
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-4 py-12 sm:px-6">
          <AuthPanel />
        </main>
      </div>
    );
  }

  const { data: frameworks, error } = await supabase
    .from("frameworks_with_questions")
    .select(
      "id, slug, name, description, questions, framework_version_id, framework_version, created_at",
    )
    .order("name");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%),linear-gradient(to_bottom,_#020617,_#020617)]">
      <SiteHeader userEmail={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="mb-10">
          <p className="text-sm font-medium text-primary">Compliance Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Assess your AI governance readiness
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose a regulatory or standards framework to run a guided,
            multi-step questionnaire. Your responses are scored and saved as an
            assessment report in Supabase.
          </p>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load frameworks: {error.message}
          </div>
        ) : null}

        {frameworks?.length ? (
          <FrameworkGrid
            frameworks={frameworks.map((framework) =>
              parseFramework(framework),
            )}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-foreground">
              No frameworks found
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run the migration and publish pipeline to load standards from the
              standards/ directory.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
