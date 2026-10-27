import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
