"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExportMarkdownButtonProps = {
  assessmentId: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
};

export function ExportMarkdownButton({
  assessmentId,
  variant = "outline",
  size = "sm",
  className,
}: ExportMarkdownButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/export`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Export failed.");
      }

      const markdown = await response.text();
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `assessment-${assessmentId}.md`;

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert(
        error instanceof Error ? error.message : "Could not export Markdown report.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isExporting}
      onClick={handleExport}
    >
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      Export Markdown
    </Button>
  );
}
