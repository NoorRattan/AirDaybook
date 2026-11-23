import "server-only";

export function releaseId() {
  const value = process.env.RELEASE_ID;
  return value && /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : "local";
}
