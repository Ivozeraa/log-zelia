import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FaArrowLeft, FaArrowRight, FaEye, FaEyeSlash, FaLock, FaSignInAlt } from "react-icons/fa"
import { Button } from "../components/ui/Button"
import bgImg from "../assets/images/escola-frente.jpg"
import logo from "../assets/images/logo-login.png"
import { notify } from "../utils/notify"
import { FormInput } from "../components/ui/FormInput"
import { useAuth } from "../hooks/useAuth"

export const Login = () => {
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  async function handleLogin(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { error } = await signIn(email, senha)
      if (error) {
        notify.error("Erro no login")
        return
      }
      notify.success("Login realizado com sucesso!")
      navigate("/app", { replace: true })
    } catch (error) {
      console.error("Erro no login:", error)
      notify.error("Não foi possível realizar o login")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 md:flex">
      <section className="relative hidden min-h-screen overflow-hidden md:flex md:w-[48%] lg:w-[52%]">
        <img src={bgImg} alt="Escola" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/75 via-green-800/55 to-slate-950/85" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 lg:p-12">
          <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white"><FaArrowLeft className="text-xs" /> Voltar para o início</Link>
          <div className="max-w-lg">
            <img src={logo} alt="Log Zélia" className="mb-8 w-56 object-contain lg:w-64" />
            <h1 className="text-4xl font-black leading-tight text-white lg:text-5xl">Seu ambiente escolar, em um só lugar.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/75 lg:text-lg">Acesse horários, alunos, ocorrências, notificações e as ferramentas de gestão do LogZélia.</p>
          </div>
          <p className="text-xs text-white/50">LogZélia · Sistema de gestão escolar</p>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 sm:px-6 md:bg-slate-50 dark:bg-slate-950">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-500/10 blur-3xl md:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl md:hidden" />
        <div className="relative w-full max-w-md">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400"><FaArrowLeft className="text-xs" /> Início</Link>
            <img src={logo} alt="Log Zélia" className="h-10 w-auto object-contain" />
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-7 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none dark:border-slate-800 dark:bg-slate-900 md:dark:bg-transparent">
            <div className="mb-7 md:mb-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700 md:hidden dark:bg-green-950/50 dark:text-green-300"><FaSignInAlt /></div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Área restrita</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Entrar no LogZélia</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Use suas credenciais para acessar o ambiente da escola.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</label>
                <FormInput type="email" placeholder="seu@email.com" onChange={(e) => setEmail(e.target.value)} className="w-full" disabled={submitting} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Senha</label>
                <div className="relative">
                  <FormInput type={showPassword ? "text" : "password"} placeholder="Sua senha" onChange={(e) => setSenha(e.target.value)} className="w-full pr-12" disabled={submitting} />
                  <button type="button" disabled={submitting} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:hover:bg-slate-800 dark:hover:text-slate-200">{showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}</button>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400"><FaLock className="shrink-0 text-green-600" /><span>Seu acesso é protegido pelas permissões da sua conta.</span></div>
              <Button className="mt-2 w-full rounded-xl py-3.5 text-sm font-bold sm:py-3" type="submit" disabled={submitting}>{submitting ? "Entrando..." : "Entrar no sistema"}{!submitting && <FaArrowRight className="ml-1 text-xs" />}</Button>
            </form>
            <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">LogZélia · Gestão escolar</div>
          </div>
        </div>
      </section>
    </main>
  )
}
