// Spielstand im Browser: src/core/storage.ts (localStorage, Fallback Arbeitsspeicher) + src/game/save.ts (Zod, Version).
import type { KeyValueStore } from '../../core/storage';
import type { GearDb } from '../../data/gear';
import { newProfile, parseSave, serializeSave, type Profile, type Settings } from '../../game/save';

export const SAVE_KEY = 'spielstand';

export async function loadSave(store: KeyValueStore, gear: GearDb): Promise<{ profile: Profile; settings: Settings; warning: string | null }> {
  const text = await store.get(SAVE_KEY);
  if (!text) return { profile: newProfile(gear), settings: {}, warning: null };
  const r = parseSave(text);
  if (!r.ok) return { profile: newProfile(gear), settings: {}, warning: r.error };
  return { profile: r.save.profile, settings: r.save.settings ?? {}, warning: null };
}

export async function writeSave(store: KeyValueStore, profile: Profile, settings: Settings): Promise<boolean> {
  return store.set(SAVE_KEY, serializeSave(profile, Date.now(), settings));
}
