import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only; every page and action verifies the session cookie and role on the server.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || request.cookies.get("__session")) return NextResponse.next();
  // Staff pages go to the staff login at /admin/login, the client portal to the client login.
  if (!pathname.startsWith("/admin")) return NextResponse.redirect(new URL("/login", request.url));
  // Remember the page that was asked for (a scanned bundle label, say) so sign-in returns to it.
  const login = new URL("/admin/login", request.url);
  if (pathname !== "/admin") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/portal/:path*"] };
