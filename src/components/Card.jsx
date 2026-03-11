export const Card = ({ title, content, subtitle }) => {
  return (
    <div className='bg-white shadow-md shadow-slate-200 sh rounded-lg p-4'>
      <h3 className='text-lg font-bold mb-2'>{title}</h3>
      <p className='text-gray-600'>{content}</p>
      <p>{subtitle}</p>
    </div>
  )
}
