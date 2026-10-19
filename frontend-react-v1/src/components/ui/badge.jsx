import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        open:
          "bg-emerald-500 dark:bg-emerald-500/20 border dark:border-emerald-800 text-white shadow-md",
        closed:
          "bg-red-500 dark:bg-red-500/20 border dark:border-red-800 text-white shadow-md",
        accepted:
          "bg-emerald-500 dark:bg-emerald-500/20 border dark:border-emerald-800 text-white shadow-md",
        rejected:
          "bg-red-500 dark:bg-red-500/20 border dark:border-red-800 text-white shadow-md",
        pending:
          "bg-blue-500 dark:bg-blue-500/20 border dark:border-blue-800 text-white shadow-md",
        widthdrawn:
          "bg-gray-500 dark:bg-gray-500/20 border dark:border-gray-800 text-white shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }