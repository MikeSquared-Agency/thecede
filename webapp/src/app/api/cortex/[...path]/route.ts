/**
 * Next.js API proxy for Cortex HTTP API.
 * Forwards requests from /api/cortex/* → CORTEX_URL/* to avoid CORS issues.
 */

import { NextRequest, NextResponse } from "next/server";

const CORTEX_URL =
  process.env.CORTEX_BACKEND_URL ?? process.env.NEXT_PUBLIC_CORTEX_URL ?? "http://localhost:9091";

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const target = path.join("/");
  const url = new URL(`/${target}`, CORTEX_URL);

  // Forward query params
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Check if this is an SSE request (events/stream)
  if (target === "events/stream" || target.startsWith("events/stream")) {
    return proxySSE(url);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward auth header if present
  const authHeader = req.headers.get("Authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const fetchOpts: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      fetchOpts.body = await req.text();
    } catch {
      // no body
    }
  }

  try {
    const upstream = await fetch(url.toString(), fetchOpts);
    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to Cortex", detail: String(err) },
      { status: 502 }
    );
  }
}

/** Stream SSE from Cortex to the browser */
async function proxySSE(url: URL): Promise<Response> {
  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "text/event-stream" },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "SSE upstream failed", status: upstream.status },
        { status: 502 }
      );
    }

    // Pipe the readable stream directly through
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to Cortex SSE", detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

// SSE connections can be long-lived
export const maxDuration = 300;
