import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only; every page and action verifies the session cookie and role on the server.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || request.cookies.get("__session")) return NextResponse.next();
  // Staff pages go to the staff login, the client portal to the customer login.
  return NextResponse.redirect(new URL(pathname.startsWith("/admin") ? "/admin/login" : "/login", request.url));
}

export const config = { matcher: ["/admin/:path*", "/portal/:path*"] };
