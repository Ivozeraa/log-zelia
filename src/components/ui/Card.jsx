export const Card = ({ title, content }) => {
  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-950 p-4'>
      <h3 className='text-sm text-slate-500 dark:text-slate-400'>{title}</h3>
      <p className='text-3xl font-bold text-slate-900 dark:text-white'>{content}</p>
    </div>
  )
}