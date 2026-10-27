import type { SupabaseClient } from "@supabase/supabase-js";

type EstimateMetadataRow = {
  entry_id: string;
  people_ahead: number;
  est_minutes: number;
  current_visit_delayed: boolean;
};

export type QueueEstimateMetadata = Omit<EstimateMetadataRow, "entry_id">;

export async function loadQueueEstimateMetadata(
  supabase: SupabaseClient,
  entryIds: string[],
): Promise<Map<string, QueueEstimateMetadata> | null> {
  if (entryIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("queue_estimate_metadata", {
    p_entry_ids: entryIds,
  });

  // Keep the current queue status usable during a temporary connection issue
  // or when the frontend is deployed before the database migration.
  if (error) return null;

  return new Map(
    ((data ?? []) as EstimateMetadataRow[]).map((row) => [
      row.entry_id,
      {
        people_ahead: row.people_ahead,
        est_minutes: row.est_minutes,
        current_visit_delayed: row.current_visit_delayed,
      },
    ]),
  );
}
