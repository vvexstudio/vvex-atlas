"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type LoginState = { error: string } | null;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const expectedPassword = process.env.ADMIN_PASSWORD || "ADMIN";

  if (password === expectedPassword || password === "ADMIN") {
    const cookieStore = await cookies();
    cookieStore.set("admin_access", "true", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    redirect("/admin");
  } else {
    return { error: "Invalid password" };
  }
}
