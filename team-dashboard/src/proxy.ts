import { auth } from "@/auth";

// Next.js 16 expects a named 'proxy' export
export const proxy = auth;

export const config = {
  matcher: [
    "/((?!api|auth|backend|_next/static|_next/image|favicon.ico|icons|manifest).*)",
  ],
};
