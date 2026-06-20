import type { SupabaseClient } from "@supabase/supabase-js";

export type RelatedControl = {
  mapping_type: string;
  notes: string | null;
  control_id: string;
  title: string;
  framework_slug: string;
  framework_name: string;
  direction: "outgoing" | "incoming";
};

type ControlRow = {
  id: string;
  control_id: string;
  title: string;
  framework_versions: {
    version: string;
    frameworks: {
      slug: string;
      name: string;
    };
  };
};

type MappingRow = {
  mapping_type: string;
  notes: string | null;
  source_control_id: string;
  target_control_id: string;
  source: ControlRow;
  target: ControlRow;
};

export async function fetchRelatedControlsForVersion(
  supabase: SupabaseClient,
  frameworkVersionId: string,
  answeredControlIds: string[],
): Promise<RelatedControl[]> {
  if (answeredControlIds.length === 0) return [];

  const { data: controls, error: controlsError } = await supabase
    .from("controls")
    .select("id, control_id")
    .eq("framework_version_id", frameworkVersionId)
    .in("control_id", answeredControlIds);

  if (controlsError || !controls?.length) return [];

  const controlUuidByKey = new Map(
    controls.map((row) => [row.control_id, row.id as string]),
  );
  const sourceUuids = [...controlUuidByKey.values()];

  const { data: outgoing, error: outError } = await supabase
    .from("control_mappings")
    .select(
      `
      mapping_type,
      notes,
      source_control_id,
      target_control_id,
      target:controls!control_mappings_target_control_id_fkey (
        id,
        control_id,
        title,
        framework_versions (
          version,
          frameworks ( slug, name )
        )
      )
    `,
    )
    .in("source_control_id", sourceUuids);

  if (outError) return [];

  const related: RelatedControl[] = [];

  for (const row of outgoing ?? []) {
    const target = row.target as unknown as ControlRow;
    const sourceUuid = row.source_control_id as string;
    const sourceControlId = [...controlUuidByKey.entries()].find(
      ([, uuid]) => uuid === sourceUuid,
    )?.[0];

    if (!target || !sourceControlId) continue;

    related.push({
      mapping_type: row.mapping_type as string,
      notes: (row.notes as string | null) ?? null,
      control_id: sourceControlId,
      title: target.title,
      framework_slug: target.framework_versions.frameworks.slug,
      framework_name: target.framework_versions.frameworks.name,
      direction: "outgoing",
    });
  }

  return related;
}

export async function fetchAllCrosswalkMappings(
  supabase: SupabaseClient,
): Promise<
  Array<{
    mapping_type: string;
    notes: string | null;
    source_framework: string;
    source_control_id: string;
    source_title: string;
    target_framework: string;
    target_control_id: string;
    target_title: string;
  }>
> {
  const { data, error } = await supabase.from("control_mappings").select(`
      mapping_type,
      notes,
      source:controls!control_mappings_source_control_id_fkey (
        control_id,
        title,
        framework_versions (
          frameworks ( slug, name )
        )
      ),
      target:controls!control_mappings_target_control_id_fkey (
        control_id,
        title,
        framework_versions (
          frameworks ( slug, name )
        )
      )
    `);

  if (error || !data) return [];

  return data.map((row) => {
    const source = row.source as unknown as ControlRow;
    const target = row.target as unknown as ControlRow;

    return {
      mapping_type: row.mapping_type as string,
      notes: (row.notes as string | null) ?? null,
      source_framework: source.framework_versions.frameworks.name,
      source_control_id: source.control_id,
      source_title: source.title,
      target_framework: target.framework_versions.frameworks.name,
      target_control_id: target.control_id,
      target_title: target.title,
    };
  });
}
