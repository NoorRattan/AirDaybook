import type { Draft } from "./draft-schema";
import { emptyPreferences } from "./preferences";
export type { Draft, Plan } from "./draft-schema";

export const emptyDraft: Draft = {
  version: 1, selection: null, plan: null,
  preferences: emptyPreferences, previousPreferences: null,
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
  const saved = await new Promise<unknown>((resolve, reject) => {
    const request = database.transaction("workspace").objectStore("workspace").get("draft");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (saved === undefined) return emptyDraft;
  const { draftSchema } = await import("./draft-schema");
  const result = draftSchema.safeParse(saved);
  return result.success ? result.data : emptyDraft;
}

export async function writeDraft(draft: Draft) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("workspace", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft write interrupted."));
    const store = transaction.objectStore("workspace");
    if (draft === emptyDraft) store.delete("draft");
    else store.put(draft, "draft");
  });
}
