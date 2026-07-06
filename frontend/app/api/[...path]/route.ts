import { NextRequest, NextResponse } from "next/server";

const API_PROXY =
  process.env.API_PROXY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const PROXY_TIMEOUT_MS = 12000;

async function proxyRequest(request: NextRequest, path: string) {
  const url = new URL(request.url);
  const target = `${API_PROXY}/api/${path}${url.search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  const init: RequestInit = {
    method: request.method,
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: controller.signal,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) {
      init.body = body;
      (init.headers as Record<string, string>)["Content-Type"] =
        request.headers.get("content-type") || "application/json";
    }
  }

  try {
    const response = await fetch(target, init);
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    if (path === "suggest") {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { detail: "API temporarily unavailable" },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path.join("/"));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path.join("/"));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path.join("/"));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path.join("/"));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path.join("/"));
}
