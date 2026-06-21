import { NextResponse } from "next/server";

import { getAssessmentMarkdownExport } from "@/lib/assessment-export";

type ExportRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ExportRouteProps) {
  const { id } = await params;
  const result = await getAssessmentMarkdownExport(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(result.markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
