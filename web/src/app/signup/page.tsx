import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getSession()) redirect("/explore");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="text-xl mb-1">Create your free account</h1>
          <p className="text-sm text-muted mb-5">
            Everything is free. An account just tells us who&apos;s finding it useful.
          </p>
          <Suspense>
            <AuthForm mode="signup" />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
