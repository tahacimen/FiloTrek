import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

// Lightweight public health probe. Runs a trivial query so a periodic hit
// (see .github/workflows/keepalive.yml) counts as database activity and keeps
// the free-tier Supabase project from auto-pausing after inactivity. proxy.ts
// already excludes /api from its auth matcher, so this needs no login. Must be
// dynamic + the Node.js runtime because it opens a real DB connection.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
