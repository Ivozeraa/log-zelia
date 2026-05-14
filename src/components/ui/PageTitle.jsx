import React from 'react'

export const PageTitle = ({ title, subtitle }) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  )
}
