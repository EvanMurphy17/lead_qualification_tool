/**
 * Minimal design-system primitives, per the brand component rules:
 * buttons = primary bg + #0A0A0A text (accent on hover), rounded-md;
 * cards = border #2C2C2C on #0A0A0A; inputs = border + muted placeholder.
 */
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        // White text on navy (~16.5:1), flipping to dark foreground on the
        // blue-gray accent hover (~7.4:1) — accent is too light for white text.
        variant === "primary" && "bg-primary text-background font-semibold hover:bg-accent hover:text-foreground",
        variant === "outline" && "border border-border text-foreground hover:border-accent hover:text-accent",
        variant === "ghost" && "text-muted hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 outline-none focus:border-primary transition-colors",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full appearance-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded-md border border-border bg-background p-5", className)}>
      {children}
    </div>
  );
}

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx("text-xs font-medium uppercase tracking-wide text-muted", className)}>
      {children}
    </span>
  );
}
