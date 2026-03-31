export const Card = ({ title, content, subtitle }) => {
  return (
    <div className='flex flex-col gap-2 items-center justify-center w-full bg-white shadow-md rounded-lg p-6 h-60'>
      <h3 className='text- font-bold'>{title}</h3>
      <p className='text-6xl font-extrabold text-orange-600'>{content}</p>
      <p className="text-gray-500 text-md">{subtitle}</p>
    </div>
  )
}