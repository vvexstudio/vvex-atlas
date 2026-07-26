"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <main className="admin-login">
      <form action={formAction} className="card card-raised admin-login-card">
        <h1 className="admin-login-title">
          <Icon name="lock" size={20} />
          Admin Login
        </h1>

        <div className="admin-login-field">
          <label htmlFor="password" className="admin-label">
            Password
          </label>
          <input type="password" id="password" name="password" required className="admin-input" />
        </div>

        {state?.error && <p className="admin-form-error">{state.error}</p>}

        <Button variant="primary" type="submit" disabled={pending} className="admin-login-submit">
          {pending ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </main>
  );
}
