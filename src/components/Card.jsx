export const Card = ({ title, content, subtitle }) => {
  return (
    <div className='flex flex-col items-center justify-center w-full bg-white shadow-md rounded-lg p-6 h-60'>
      <h3 className='text-lg font-bold mb-2'>{title}</h3>
      <p className='text-6xl font-extrabold text-orange-600'>{content}</p>
      <p className="text-gray-500">{subtitle}</p>
    </div>
  )
}