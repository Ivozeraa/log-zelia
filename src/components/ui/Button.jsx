import * as React from "react"

import { cn } from "../../lib/utils"

const variantClasses = {
  default:
    "bg-green-700 text-white hover:bg-green-800 border-transparent",

  outline:
    "bg-slate-600 text-white border-slate-300 hover:bg-slate-500",

  secondary:
    "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",

  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",

  destructive:
    "bg-red-600 text-white hover:bg-red-700 border-transparent",

  link:
    "bg-transparent text-green-700 underline-offset-4 hover:underline dark:text-green-400",
}

const sizeClasses = {
  default: "h-10 gap-2 px-4",
  xs: "h-8 gap-1 rounded-md px-2.5 text-xs",
  sm: "h-9 gap-2 px-3",
  lg: "h-11 gap-2 px-5",
  icon: "h-10 w-10 p-0",
  "icon-xs": "h-8 w-8 p-0",
  "icon-sm": "h-9 w-9 p-0",
  "icon-lg": "h-12 w-12 p-0",
}

function Button({ className, variant = "default", size = "default", ...props }) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 disabled:pointer-events-none disabled:opacity-50"

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  )
}

// teste

export { Button }
