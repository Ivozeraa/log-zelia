import { useState } from "react"
import { supabase } from "../utils/supabase"
import { useNavigate } from "react-router-dom"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import { Button } from '../components/ui/Button'

import bgImg from "../assets/images/escola-frente.jpg"
import logo from "../assets/images/logo-login.png"
import { notify } from '../utils/notify'
import { FormInput } from "../components/ui/FormInput"

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
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">

      {/* Painel da foto */}
      <section className="relative w-full h-56 md:h-auto md:w-1/2 flex-shrink-0">
        <img
          src={bgImg}
          alt="Escola"
          className="w-full h-full object-cover md:rounded-r-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-700/50 to-green-900/80 md:rounded-r-3xl" />

        {/* Logo + texto sobre a imagem */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <img
            src={logo}
            alt="Logo"
            className="w-52 md:w-84 drop-shadow-lg object-contain"
          />
        </div>
      </section>

      {/* Painel do formulário */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 md:py-0">
        <div className="w-full max-w-sm">

          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl font-bold text-gray-800">Login</h1>
            <p className="text-sm text-gray-400 mt-1">Entre com suas credenciais para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <FormInput
              type="email"
              placeholder="E-mail"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />

            <div className="relative">
              <FormInput
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                onChange={(e) => setSenha(e.target.value)}
                className="w-full pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>

            <div className="text-right">
              <a href="#" className="text-xs text-green-600 hover:underline">

              </a>
            </div>

            <Button className="w-full mt-2" type="submit">
              Entrar
            </Button>
          </form>

        </div>
      </div>

    </div>
  )
}