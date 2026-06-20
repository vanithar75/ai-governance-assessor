import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Globe2,
  Layers3,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Framework } from "@/lib/types";
import { cn } from "@/lib/utils";

const frameworkMeta: Record<
  string,
  { icon: typeof Shield; accent: string; badge: string }
> = {
  "NIST AI RMF": {
    icon: Shield,
    accent: "from-blue-500/15 to-cyan-500/10 text-blue-700 dark:text-blue-300",
    badge: "US Federal",
  },
  "EU AI Act": {
    icon: Globe2,
    accent: "from-indigo-500/15 to-violet-500/10 text-indigo-700 dark:text-indigo-300",
    badge: "European Union",
  },
  "ISO/IEC 42001": {
    icon: Layers3,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-700 dark:text-emerald-300",
    badge: "International",
  },
};

type FrameworkCardProps = {
  framework: Framework;
};

export function FrameworkCard({ framework }: FrameworkCardProps) {
  const questionCount = framework.questions.sections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );
  const sectionCount = framework.questions.sections.length;
  const meta = frameworkMeta[framework.name] ?? {
    icon: ClipboardCheck,
    accent: "from-muted to-muted text-foreground",
    badge: "Compliance",
  };
  const Icon = meta.icon;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-lg hover:shadow-black/5">
      <div className={cn("bg-gradient-to-br px-6 py-5", meta.accent)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-background/80 shadow-sm">
            <Icon className="size-5" />
          </div>
          <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium">
            {meta.badge}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          {framework.name}
        </h3>
      </div>

      <div className="flex flex-1 flex-col px-6 py-5">
        <p className="line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
          {framework.description}
        </p>

        <div className="mt-5 flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <span>{sectionCount} sections</span>
          <span className="size-1 rounded-full bg-border" />
          <span>{questionCount} questions</span>
        </div>

        <Button
          className="mt-6 w-full"
          nativeButton={false}
          render={<Link href={`/assess/${framework.id}`} />}
        >
          Start assessment
          <ArrowRight />
        </Button>
      </div>
    </article>
  );
}
