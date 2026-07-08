"use client";

/**
 * app/(onboarding)/submit-button.tsx — form submit button with pending state
 * (used by the landing CTA and the Operating Rules editor).
 */

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/primitives";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
