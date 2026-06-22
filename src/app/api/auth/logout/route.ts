import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("portal_user_session");
  
  return NextResponse.redirect(new URL("/login", request.url));
}
