import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const retroButtonVariants = cva(
  "relative inline-flex min-w-24 cursor-pointer items-center justify-center rounded-[2px] border-2 border-transparent bg-[#010101] shadow-[1px_1px_1px_rgba(255,255,255,0.6)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "text-white",
          "[--bg-color:var(--color-orange-500)]",
          "[--bg-color-active:var(--color-orange-600)]",
          "[--shadow-light:var(--color-orange-300)]",
          "[--shadow-dark:var(--color-orange-700)]",
        ],
        cyan: [
          "text-white",
          "[--bg-color:var(--color-sky-600)]",
          "[--bg-color-active:var(--color-sky-700)]",
          "[--shadow-light:var(--color-sky-300)]",
          "[--shadow-dark:var(--color-sky-900)]",
        ],
        darkGray: [
          "text-white",
          "[--bg-color:var(--color-neutral-700)]",
          "[--bg-color-active:var(--color-neutral-800)]",
          "[--shadow-light:var(--color-neutral-400)]",
          "[--shadow-dark:var(--color-neutral-900)]",
        ],
        white: [
          "text-black",
          "[--bg-color:var(--color-neutral-200)]",
          "[--bg-color-active:var(--color-neutral-300)]",
          "[--shadow-light:var(--color-white)]",
          "[--shadow-dark:var(--color-neutral-500)]",
        ],
        lightGray: [
          "text-white",
          "[--bg-color:var(--color-neutral-400)]",
          "[--bg-color-active:var(--color-neutral-500)]",
          "[--shadow-light:var(--color-neutral-200)]",
          "[--shadow-dark:var(--color-neutral-600)]",
        ],
        gray: [
          "text-white",
          "[--bg-color:var(--color-neutral-600)]",
          "[--bg-color-active:var(--color-neutral-700)]",
          "[--shadow-light:var(--color-neutral-400)]",
          "[--shadow-dark:var(--color-neutral-800)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const retroButtonInnerVariants = cva([
  "inline-block w-full rounded-[9px] px-3 py-2 text-xs",
  "uppercase tracking-wider text-center",
  "bg-[var(--bg-color)] transition-all duration-200",
  "shadow-[inset_1px_1px_1px_var(--shadow-light),inset_-1px_-1px_1px_var(--shadow-dark),2px_2px_4px_#000]",
  "active:scale-[0.98] active:bg-[var(--bg-color-active)]",
  "active:shadow-[inset_0_0_4px_#000,inset_1px_1px_1px_transparent,inset_-1px_-1px_1px_transparent,2px_2px_4px_transparent]",
]);

export interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof retroButtonVariants> {
  children: React.ReactNode;
}

const RetroButton = React.forwardRef<HTMLButtonElement, RetroButtonProps>(({ className, variant, children, ...props }, ref) => {
  return (
    <button className={cn(retroButtonVariants({ variant, className }))} ref={ref} {...props}>
      <span className={retroButtonInnerVariants()}>{children}</span>
    </button>
  );
});
RetroButton.displayName = "RetroButton";

export { RetroButton };
