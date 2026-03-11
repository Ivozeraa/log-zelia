import { useState } from "react"
import { supabase } from "../utils/supabase"
import { useNavigate } from "react-router-dom"

import img from "../assets/images/img.jpg"

export const Login = () => {

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")

  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    })

    if (error) {
      alert("Erro no login")
      return
    }

    navigate("/")
  }

  return (
    <div className="flex h-screen">

      <div className="w-1/2 h-full">
        <img
          src={img}
          alt="Imagem de login"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="w-1/2 flex items-center justify-center bg-gray-100">
        <form
          onSubmit={handleLogin}
          className="p-8 w-full max-w-md space-y-5"
        >

          <h1 className="text-2xl font-bold text-center text-gray-800">
            Sistema de Ocorrências
          </h1>

          <input
            type="email"
            placeholder="Email"
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={e => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={e => setSenha(e.target.value)}
          />

          <button
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
          >
            Entrar
          </button>

        </form>
      </div>

    </div>
  )
}