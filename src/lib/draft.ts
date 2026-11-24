import type { Draft } from "./draft-schema";
import { mergeDraftFields } from "./draft-merge";
import { emptyPreferences, preferenceKeys } from "./preferences";
export type { Draft, Plan } from "./draft-schema";

export const emptyDraft: Draft = {
  version: 1, selection: null, plan: null,
  preferences: emptyPreferences, previousPreferences: null, travel: null, routine: null,
};

export function hasSavedWorkspaceData(draft: Draft) {
  return Boolean(draft.selection || draft.plan || draft.travel || draft.routine || draft.previousPreferences ||
    preferenceKeys.some((key) => draft.preferences[key] !== null));
}

let opening: Promise<IDBDatabase> | undefined;
function openStore() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("airdaybook", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Draft storage is busy."));
  }).catch((error: unknown) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

export async function readDraft() {
  const database = await openStore();
  const [saved, travel, routine] = await new Promise<[unknown, unknown, unknown]>((resolve, reject) => {
    const transaction = database.transaction("workspace");
    const store = transaction.objectStore("workspace");
    const draftRequest = store.get("draft");
    const travelRequest = store.get("travel");
    const routineRequest = store.get("routine");
    transaction.oncomplete = () => resolve([draftRequest.result, travelRequest.result, routineRequest.result]);
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft read interrupted."));
  });
  if (saved === undefined) return emptyDraft;
  const { draftSchema } = await import("./draft-schema");
  const result = draftSchema.safeParse(saved);
  if (!result.success) return emptyDraft;
  const routes = travel === undefined ? null : (await import("./travel-schema")).travelComparisonSchema.safeParse(travel);
  const daily = routine === undefined ? null : (await import("./routine")).routineSchema.safeParse(routine);
  return { ...result.data, travel: routes?.success ? routes.data : null, routine: daily?.success ? daily.data : null };
}

export async function writeDraft(previous: Draft, next: Draft) {
  const database = await openStore();
  const [{ draftSchema }, { travelComparisonSchema }, { routineSchema }] = await Promise.all([
    import("./draft-schema"), import("./travel-schema"), import("./routine"),
  ]);
  return new Promise<Draft>((resolve, reject) => {
    let merged = emptyDraft;
    const transaction = database.transaction("workspace", "readwrite");
    transaction.oncomplete = () => resolve(merged);
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft write interrupted."));
    const store = transaction.objectStore("workspace");
    if (next === emptyDraft) {
      store.delete("draft");
      store.delete("travel");
      store.delete("routine");
    } else {
      const draftRequest = store.get("draft");
      const travelRequest = store.get("travel");
      const routineRequest = store.get("routine");
      routineRequest.onsuccess = () => {
        const parsed = draftSchema.safeParse(draftRequest.result);
        const routes = travelComparisonSchema.safeParse(travelRequest.result);
        const daily = routineSchema.safeParse(routineRequest.result);
        const saved = parsed.success ? { ...parsed.data, travel: routes.success ? routes.data : null, routine: daily.success ? daily.data : null } : emptyDraft;
        merged = mergeDraftFields(saved, previous, next);
        const { travel, routine, ...base } = merged;
        // Older offline shells still validate the base record with a strict schema.
        store.put(base, "draft");
        if (travel) store.put(travel, "travel");
        else store.delete("travel");
        if (routine) store.put(routine, "routine");
        else store.delete("routine");
      };
    }
  });
}
