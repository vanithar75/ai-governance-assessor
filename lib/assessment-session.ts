import type { AssessmentMode, AssessmentSessionConfig, CustomerProfile } from "@/lib/types";

export function parseAssessmentSessionConfig(
  searchParams: Record<string, string | string[] | undefined>,
): AssessmentSessionConfig {
  const modeParam = searchParams.mode;
  const modeValue = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const assessmentMode: AssessmentMode =
    modeValue === "customer" ? "customer" : "internal";

  if (assessmentMode !== "customer") {
    return { assessmentMode: "internal", customerProfile: null };
  }

  const getParam = (key: string) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };

  const companyName = getParam("companyName");
  const rfpReference = getParam("rfpReference");
  const industry = getParam("industry");
  const contactEmail = getParam("contactEmail");

  if (!companyName || !rfpReference || !industry) {
    return { assessmentMode: "internal", customerProfile: null };
  }

  const customerProfile: CustomerProfile = {
    companyName,
    rfpReference,
    industry,
    ...(contactEmail ? { contactEmail } : {}),
  };

  return { assessmentMode: "customer", customerProfile };
}

export function buildAssessmentStartUrl(
  frameworkId: string,
  config: AssessmentSessionConfig,
): string {
  if (config.assessmentMode === "internal") {
    return `/assess/${frameworkId}?mode=internal`;
  }

  const params = new URLSearchParams({
    mode: "customer",
    companyName: config.customerProfile?.companyName ?? "",
    rfpReference: config.customerProfile?.rfpReference ?? "",
    industry: config.customerProfile?.industry ?? "",
  });

  if (config.customerProfile?.contactEmail) {
    params.set("contactEmail", config.customerProfile.contactEmail);
  }

  return `/assess/${frameworkId}?${params.toString()}`;
}
