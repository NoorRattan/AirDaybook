import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export function clientQuotaKey(forwarded: string | null, key: string) {
  const ip = forwarded?.trim() ?? "";
  const family = isIP(ip);
  if (!family || ip.includes("%")) return null;
  let identity = ip;
  if (family === 6) {
    const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
    const [head, tail] = canonical.split("::");
    const leading = head ? head.split(":") : [];
    const trailing = tail ? tail.split(":") : [];
    const groups = tail === undefined ? leading : [
      ...leading, ...Array<string>(8 - leading.length - trailing.length).fill("0"), ...trailing,
    ];
    if (groups.slice(0, 5).every((part) => part === "0") && groups[5] === "ffff") {
      const v4 = Number.parseInt(groups[6] + groups[7].padStart(4, "0"), 16);
      identity = [v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join(".");
    } else {
      identity = groups.slice(0, 4).join(":");
    }
  }
  return createHmac("sha256", key).update("airdaybook/quota/v1:" + identity).digest("hex");
}
