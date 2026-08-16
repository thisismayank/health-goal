"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOnboardingComplete } from "@/lib/actions";

export function FinishOnboardingButton({
  label,
  primary = false,
  variant = "primary",
}: {
  label: string;
  primary?: boolean;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const styles =
    variant === "ghost" || !primary
      ? "text-sm text-muted hover:text-foreground underline underline-offset-4"
      : "w-full sm:w-auto sm:min-w-[280px] rounded-md bg-accent-strong text-background font-medium px-6 py-3 hover:bg-accent transition text-center";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markOnboardingComplete();
          router.replace("/trails");
        })
      }
      className={`${styles} disabled:opacity-50`}
    >
      {pending ? "…" : label}
    </button>
  );
}
