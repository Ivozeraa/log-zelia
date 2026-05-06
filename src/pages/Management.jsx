import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

export const Management = () => {
const { user } = useAuth();

  const [isDiretor, setIsDirector] = useState();

  useEffect(() => {
    if (user) {
      setIsDirector(user.role_id === 1 || user.role_id === 2 || user.role_id === 3);
    }
  }, [user]);

  return(
    <>
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Gerenciamento</h1>
      {isDiretor ? (
        <p className='text-2xl'>
          Bem vindo(a), <span className='text-green-700'>{user?.nome}</span>!
        </p>
      ) : (
        <p>Você não tem permissão para acessar esta página.</p>
      )}
    </div>
    </>
  )
}
