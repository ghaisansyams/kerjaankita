"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string;
};

/**
 * Submit button that reflects the enclosing form's pending state.
 * Use inside a <form action={…}> (works with useActionState).
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className={cn(className)}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
