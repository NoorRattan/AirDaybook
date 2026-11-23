import type { Draft } from "./draft-schema";
import { mergeDraftFields } from "./draft-merge";
import { emptyPreferences } from "./preferences";
export type { Draft, Plan } from "./draft-schema";

export const emptyDraft: Draft = {
  version: 1, selection: null, plan: null,
  preferences: emptyPreferences, previousPreferences: null, travel: null,
};

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
  const [saved, travel] = await new Promise<[unknown, unknown]>((resolve, reject) => {
    const transaction = database.transaction("workspace");
    const store = transaction.objectStore("workspace");
    const draftRequest = store.get("draft");
    const travelRequest = store.get("travel");
    transaction.oncomplete = () => resolve([draftRequest.result, travelRequest.result]);
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft read interrupted."));
  });
  if (saved === undefined) return emptyDraft;
  const { draftSchema } = await import("./draft-schema");
  const result = draftSchema.safeParse(saved);
  if (!result.success) return emptyDraft;
  if (travel === undefined) return { ...result.data, travel: null };
  const { travelComparisonSchema } = await import("./travel-schema");
  const routes = travelComparisonSchema.safeParse(travel);
  return { ...result.data, travel: routes.success ? routes.data : null };
}

export async function writeDraft(previous: Draft, next: Draft) {
  const database = await openStore();
  const { draftSchema } = await import("./draft-schema");
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("workspace", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft write interrupted."));
    const store = transaction.objectStore("workspace");
    if (next === emptyDraft) {
      store.delete("draft");
      store.delete("travel");
    } else {
      const request = store.get("draft");
      request.onsuccess = () => {
        const parsed = draftSchema.safeParse(request.result);
        const saved = parsed.success ? { ...parsed.data, travel: null } : emptyDraft;
        const { travel, ...base } = mergeDraftFields(saved, previous, next);
        // Older offline shells still validate the base record with a strict schema.
        store.put(base, "draft");
        if (previous.travel === next.travel) return;
        if (travel) store.put(travel, "travel");
        else store.delete("travel");
      };
    }
  });
}
