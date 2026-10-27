"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function ActionSubmit({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
    }) {
    
  const { pending: isPending } = useFormStatus();
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? pending : idle}
    </Button>
  );
}
