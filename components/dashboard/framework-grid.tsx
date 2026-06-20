import type { Framework } from "@/lib/types";

import { FrameworkCard } from "./framework-card";

type FrameworkGridProps = {
  frameworks: Framework[];
};

export function FrameworkGrid({ frameworks }: FrameworkGridProps) {
  return (
    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {frameworks.map((framework) => (
        <FrameworkCard key={framework.id} framework={framework} />
      ))}
    </section>
  );
}
