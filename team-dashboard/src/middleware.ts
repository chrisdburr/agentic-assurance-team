import { auth } from "@/auth";

export default auth;

export const config = {
  matcher: ["/((?!api|auth|backend|_next/static|_next/image|favicon.ico|icons|manifest).*)"],
};
