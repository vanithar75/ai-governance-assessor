import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        Framework not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The assessment you requested does not exist or may have been removed.
      </p>
      <Button className="mt-6" nativeButton={false} render={<Link href="/" />}>
        Return to dashboard
      </Button>
    </div>
  );
}
