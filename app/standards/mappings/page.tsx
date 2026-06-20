import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GitCompareArrows } from "lucide-react";

import { SiteHeader } from "@/components/dashboard/site-header";
import { Button } from "@/components/ui/button";
import { fetchAllCrosswalkMappings } from "@/lib/control-mappings";
import { createClient } from "@/lib/supabase/server";

export default async function StandardsMappingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const mappings = await fetchAllCrosswalkMappings(supabase);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(to_bottom,_#020617,_#020617)]">
      <SiteHeader userEmail={user.email} showBack />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 space-y-4">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeft />
            Back to dashboard
          </Button>

          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GitCompareArrows className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Cross-framework control mappings
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Curated crosswalk between NIST AI RMF, ISO/IEC 42001, and EU AI
                  Act controls. Source of truth lives in{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    standards/mappings/
                  </code>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        {mappings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="text-lg font-medium text-foreground">No mappings yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                npm run publish-mappings
              </code>{" "}
              after publishing standards.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mappings.map((mapping, index) => (
              <article
                key={`${mapping.source_control_id}-${mapping.target_control_id}-${index}`}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-foreground">
                    {mapping.mapping_type}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {mapping.source_framework}
                    </p>
                    <p className="mt-1 font-mono text-xs text-primary">
                      {mapping.source_control_id}
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {mapping.source_title}
                    </p>
                  </div>

                  <div className="hidden text-muted-foreground md:block">→</div>

                  <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {mapping.target_framework}
                    </p>
                    <p className="mt-1 font-mono text-xs text-primary">
                      {mapping.target_control_id}
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {mapping.target_title}
                    </p>
                  </div>
                </div>

                {mapping.notes ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {mapping.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
