import { releaseId } from "@/lib/server/operations";

export function GET() {
  return Response.json({ status: "ok" }, {
    headers: { "Cache-Control": "no-store", "X-AirDaybook-Release": releaseId() },
  });
}

const methodHeaders = { Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: methodHeaders });
}

function methodNotAllowed() {
  return new Response(null, { status: 405, headers: methodHeaders });
}

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE };
