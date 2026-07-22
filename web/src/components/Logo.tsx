import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { IconZap } from "@/components/icons";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-background group-hover:bg-accent group-hover:text-foreground transition-colors">
        <IconZap size={18} />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
