// supabase/functions/_shared/loopLearner.ts
import { supabase } from "./supabaseClient.ts";

interface LoopProfile {
  user_id: string;
  weights: Record<string, number[]>; // loop -> per-trigger weight multipliers
  custom_triggers: Record<string, string[]>;
  feedback_count: number;
  last_adjustment: string;
}

const LEARNING_RATE = 0.1;

async function getOrCreateProfile(userId: string): Promise<LoopProfile> {
  const { data, error } = await supabase
    .from("loop_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as LoopProfile;

  const { data: created, error: createError } = await supabase
    .from("loop_profiles")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (createError) throw createError;
  return created as LoopProfile;
}

function adjustWeights(
  currentWeights: number[] | undefined,
  triggeredIndices: number[],
  totalTriggers: number,
  delta: number,
): number[] {
  const weights = currentWeights ?? Array(totalTriggers).fill(1.0);
  const adjusted = [...weights];
  for (const idx of triggeredIndices) {
    if (idx >= 0 && idx < adjusted.length) {
      adjusted[idx] = Math.max(0.1, Math.min(3.0, adjusted[idx] + delta));
    }
  }
  return adjusted;
}

export async function reinforcePositive(
  userId: string,
  loop: string,
  triggeredIndices: number[],
  _energyLevel: number,
): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const weights = { ...profile.weights };
  const loopWeights = weights[loop] as number[] | undefined;

  // Increase weights for triggered indices (they helped identify the loop correctly)
  weights[loop] = adjustWeights(loopWeights, triggeredIndices, triggeredIndices.length + 1, LEARNING_RATE);

  await supabase
    .from("loop_profiles")
    .upsert({
      user_id: userId,
      weights,
      custom_triggers: profile.custom_triggers,
      feedback_count: profile.feedback_count + 1,
      last_adjustment: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function reinforceNegative(
  userId: string,
  loop: string,
  triggeredIndices: number[],
  _energyLevel: number,
): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const weights = { ...profile.weights };
  const loopWeights = weights[loop] as number[] | undefined;

  // Decrease weights for triggered indices (false positive — these triggers were misleading)
  weights[loop] = adjustWeights(loopWeights, triggeredIndices, triggeredIndices.length + 1, -LEARNING_RATE);

  await supabase
    .from("loop_profiles")
    .upsert({
      user_id: userId,
      weights,
      custom_triggers: profile.custom_triggers,
      feedback_count: profile.feedback_count + 1,
      last_adjustment: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function getLoopWeights(userId: string): Promise<Record<string, number[]>> {
  const { data } = await supabase
    .from("loop_profiles")
    .select("weights")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.weights as Record<string, number[]>) ?? {};
}
