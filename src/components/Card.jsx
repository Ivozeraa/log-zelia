export const Card = ({ title, content }) => {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-4'>
      <h3 className='text-sm text-slate-500'>{title}</h3>
      <p className='text-3xl font-bold text-slate-900'>{content}</p>
    </div>
  )
}