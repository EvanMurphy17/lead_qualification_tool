"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Label, Select } from "@/components/ui";
import { IconLoader } from "@/components/icons";

const ROLES = [
  "Solar / Storage Developer",
  "EPC",
  "IPP / Asset Owner",
  "Financier / Investor",
  "Consultant",
  "Utility",
  "Other",
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/explore";

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "signup" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Full name</Label>
            <Input name="name" required autoComplete="name" placeholder="Jordan Rivera" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Company</Label>
            <Input name="company" required autoComplete="organization" placeholder="Acme Solar" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>What best describes you?</Label>
            <Select name="role" defaultValue={ROLES[0]}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>Work email</Label>
        <Input name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Password</Label>
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
        />
      </div>

      {error && <p className="text-sm font-medium text-foreground">{error}</p>}

      <Button type="submit" disabled={busy} className="mt-1 py-2.5">
        {busy && <IconLoader size={16} className="animate-spin" />}
        {mode === "signup" ? "Create free account" : "Sign in"}
      </Button>

      <p className="text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-accent">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-primary hover:text-accent">
              Create a free account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
