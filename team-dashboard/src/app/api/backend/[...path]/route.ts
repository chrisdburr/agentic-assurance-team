/**
 * Backend API Proxy Route
 *
 * Proxies requests to the team-server while injecting user identity headers.
 * This allows team-server to know which user is making requests for:
 * - Channel membership checks
 * - Session scoping (DM sessions are per-user)
 * - Audit logging
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const TEAM_SERVER_URL =
  process.env.TEAM_SERVER_URL || "http://localhost:3030";

async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  // Get the path segments after /api/backend/
  const url = new URL(request.url);
  const pathSegments = url.pathname.replace("/api/backend/", "");
  const targetUrl = `${TEAM_SERVER_URL}/api/${pathSegments}${url.search}`;

  // Get user session
  const session = await auth();

  // Build headers, injecting user identity if available
  const headers = new Headers();

  // Copy relevant headers from the original request
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  // Inject user identity headers
  if (session?.user) {
    headers.set("x-user-id", session.user.id || "");
    headers.set("x-username", session.user.username || session.user.name || "");
  }

  try {
    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Include body for methods that support it
    if (method !== "GET" && method !== "HEAD") {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    // Forward the request to team-server
    const response = await fetch(targetUrl, fetchOptions);

    // Get response body
    const responseBody = await response.text();

    // Return the response with appropriate headers
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[Backend Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend server" },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, "PUT");
}
