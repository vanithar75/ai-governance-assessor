import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  userEmail?: string | null;
  showBack?: boolean;
};

export function SiteHeader({ userEmail, showBack }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <ArrowLeft />
            </Button>
          ) : null}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-foreground">
                AI Governance Assessor
              </p>
              <p className="text-xs text-muted-foreground">
                Compliance readiness dashboard
              </p>
            </div>
          </Link>
        </div>

        {userEmail ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {userEmail}
            </span>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
