// supabase/functions/_shared/loopLearner.ts
import { supabase } from "./supabaseClient.ts";

export type LoopType = "ENXAME" | "CORO" | "PENDULO" | "SISIFO" | "ESPELHO" | "DON_QUIXOTE" | "BURNOUT" | "ALTA_DEMANDA";

interface LoopWeights {
  trigger_weights: number[];
  energy_mod: number;
  threshold: number;
}

interface LoopProfile {
  user_id: string;
  weights: Record<LoopType, LoopWeights>;
  custom_triggers: Record<string, string[]>;
  feedback_count: number;
  last_adjustment: string;
}

const BASELINE: Record<LoopType, { trigger_count: number; threshold: number }> = {
  ENXAME: { trigger_count: 7, threshold: 0.6 },
  CORO: { trigger_count: 6, threshold: 0.6 },
  PENDULO: { trigger_count: 6, threshold: 0.6 },
  SISIFO: { trigger_count: 6, threshold: 0.6 },
  ESPELHO: { trigger_count: 5, threshold: 0.6 },
  DON_QUIXOTE: { trigger_count: 6, threshold: 0.6 },
  BURNOUT: { trigger_count: 0, threshold: 1.0 },
  ALTA_DEMANDA: { trigger_count: 8, threshold: 0.6 }
};

const LEARNING_RATE = 0.05;
const DECAY_RATE = 0.001;

const ENERGY_RULES_BASE: Record<string, { min?: number; max?: number }> = {
  ENXAME: { min: 2 },
  PENDULO: { min: 2 },
  ESPELHO: { min: 3 },
  DON_QUIXOTE: { min: 3 },
  CORO: { max: 2 }
};

function createBaselineWeights(loop: LoopType): LoopWeights {
  const base = BASELINE[loop];
  return {
    trigger_weights: new Array(base.trigger_count).fill(1.0),
    energy_mod: 1.0,
    threshold: base.threshold
  };
}

export async function getLoopProfile(userId: string): Promise<LoopProfile> {
  const { data } = await supabase
    .from("loop_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (data) {
    const now = new Date();
    const last = new Date(data.last_adjustment);
    const daysPassed = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (daysPassed > 1) {
      for (const loop in data.weights) {
        data.weights[loop].threshold = Math.min(
          0.95,
          data.weights[loop].threshold * (1 + DECAY_RATE * daysPassed)
        );
      }
    }
    return data as LoopProfile;
  }

  const weights: Record<string, LoopWeights> = {};
  for (const loop in BASELINE) {
    weights[loop] = createBaselineWeights(loop as LoopType);
  }

  const newProfile: LoopProfile = {
    user_id: userId,
    weights: weights as Record<LoopType, LoopWeights>,
    custom_triggers: {},
    feedback_count: 0,
    last_adjustment: new Date().toISOString()
  };

  await supabase.from("loop_profiles").upsert(newProfile);
  return newProfile;
}

export async function reinforcePositive(
  userId: string,
  loop: LoopType,
  triggeredIndices: number[],
  energyLevel: number
) {
  const profile = await getLoopProfile(userId);
  const w = profile.weights[loop];

  for (const idx of triggeredIndices) {
    if (idx < w.trigger_weights.length) {
      w.trigger_weights[idx] = Math.min(2.0, w.trigger_weights[idx] + LEARNING_RATE);
    }
  }

  w.threshold = Math.max(0.35, w.threshold - LEARNING_RATE * 0.5);

  const rule = ENERGY_RULES_BASE[loop];
  if (rule) {
    if (rule.min !== undefined && energyLevel < rule.min) {
      w.energy_mod = Math.max(0.2, w.energy_mod - LEARNING_RATE);
    } else if (rule.max !== undefined && energyLevel > rule.max) {
      w.energy_mod = Math.max(0.2, w.energy_mod - LEARNING_RATE);
    } else {
      w.energy_mod += (1.0 - w.energy_mod) * LEARNING_RATE;
    }
  }

  profile.last_adjustment = new Date().toISOString();
  profile.feedback_count++;
  await supabase.from("loop_profiles").upsert(profile);
}

export async function reinforceNegative(
  userId: string,
  loop: LoopType,
  triggeredIndices: number[],
  energyLevel: number
) {
  const profile = await getLoopProfile(userId);
  const w = profile.weights[loop];

  for (const idx of triggeredIndices) {
    if (idx < w.trigger_weights.length) {
      w.trigger_weights[idx] = Math.max(0.1, w.trigger_weights[idx] - LEARNING_RATE);
    }
  }

  w.threshold = Math.min(0.9, w.threshold + LEARNING_RATE * 0.5);

  const rule = ENERGY_RULES_BASE[loop];
  if (rule) {
    if (rule.min !== undefined && energyLevel < rule.min) {
      w.energy_mod = Math.min(2.0, w.energy_mod + LEARNING_RATE);
    } else if (rule.max !== undefined && energyLevel > rule.max) {
      w.energy_mod = Math.min(2.0, w.energy_mod + LEARNING_RATE);
    }
  }

  profile.last_adjustment = new Date().toISOString();
  profile.feedback_count++;
  await supabase.from("loop_profiles").upsert(profile);
}

export async function addCustomTrigger(userId: string, loop: LoopType, phrase: string) {
  const { data } = await supabase
    .from("loop_profiles")
    .select("custom_triggers")
    .eq("user_id", userId)
    .single();

  const custom = data?.custom_triggers || {};
  if (!custom[loop]) custom[loop] = [];
  custom[loop].push(phrase);

  await supabase
    .from("loop_profiles")
    .upsert({ user_id: userId, custom_triggers: custom });
}

export async function getLoopWeights(userId: string): Promise<Record<string, number[]>> {
  const { data } = await supabase
    .from("loop_profiles")
    .select("weights")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.weights as Record<string, number[]>) ?? {};
}
