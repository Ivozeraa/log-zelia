import { useState } from "react"
import { supabase } from "../utils/supabase"
import { useNavigate } from "react-router-dom"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import { Button } from '../components/ui/button'

import bgImg from "../assets/images/escola-frente.jpg"
import logo from "../assets/images/logo-login.png"
import { notify } from '../utils/notify'


export const Login = () => {

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    })

    if (error) {
      notify.error("Erro no login")
      return
    }

    notify.success("Login realizado com sucesso!")
    navigate("/", { replace: true })
  }

  return (
    <div className="flex h-screen">

      <section className="w-1/2 h-full relative">
        <img
          src={bgImg}
          alt="Imagem de login"
          className="w-full h-full object-cover rounded-r-2xl"
        />

        <div className="absolute inset-0 bg-linear-to-b from-green-700/50 to-green-900/70 rounded-r-2xl"></div>

        <div className="absolute top-0 left-0 flex items-center justify-center w-full h-full">
          <img src={logo} alt="Logo" />
        </div>
      </section>

      <div className="w-1/2 flex items-center justify-center">
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

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              className="w-full border border-gray-300 rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={e => setSenha(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <Button className="w-full" type="submit">
            Entrar
          </Button>

        </form>
      </div>

    </div>
  )
}