import React from "react"
import { useSchool } from "../../hooks/useSchool"

export const PageTitle = ({ title, subtitle, showSchool = true }) => {
  const { school, isGlobalAdmin, loading } = useSchool()

  const schoolLabel = loading
    ? "Carregando escola..."
    : school?.nome
      ? school.nome
      : isGlobalAdmin
        ? "Acesso global"
        : null

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
      {showSchool && schoolLabel && (
        <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
          <span className="truncate" title={schoolLabel}>
            {schoolLabel}
          </span>
        </div>
      )}
    </div>
  )
}
