import { useAuth } from "../context/AuthContext"

export const Home = () => {
    const { user } = useAuth()
  
  return (
    <div>
      <p className='text-3xl '>Bem vindo(a), <span className='text-green-700'>{user?.nome}</span>!</p>
    </div>
  )
}
