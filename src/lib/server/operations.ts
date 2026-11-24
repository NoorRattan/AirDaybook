import "server-only";

export function releaseId() {
  const value = process.env.RELEASE_ID;
  if (value && /^[a-zA-Z0-9._-]{1,80}$/.test(value)) return value;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  return commit && /^[a-f0-9]{40}$/i.test(commit) ? commit.slice(0, 12) : "local";
}
