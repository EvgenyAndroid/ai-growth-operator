"use client";

/**
 * app/(onboarding)/submit-button.tsx — form submit button with pending state
 * (used by the landing CTA and the Operating Rules editor).
 */

import * as React from "react";
import { useFormStatus } from "react-dom";
import { ClientButton, type ClientButtonVariant } from "./client-ui";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ClientButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <ClientButton
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </ClientButton>
  );
}
