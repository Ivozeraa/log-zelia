export const Home = ({ username }) => {
  return (
    <div>
      <p className='text-3xl '>Bem vindo(a), <span className='text-green-700'>{username}</span>!</p>
    </div>
  )
}
