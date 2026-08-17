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
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/90 via-green-900/60 to-slate-950/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-green-950/20" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 lg:p-12">
          <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm font-semibold text-white/90 shadow-lg backdrop-blur-md transition hover:border-white/25 hover:bg-black/30 hover:text-white"><FaArrowLeft className="text-xs" /> Voltar para o início</Link>
          <div className="max-w-xl">
            <div className="mb-9 flex min-h-20 items-center">
              <img src={logo} alt="Log Zélia" className="w-72 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] lg:w-80" />
            </div>
            <div className="max-w-xl border-l-4 border-green-400 pl-6">
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.5)] lg:text-5xl">Seu ambiente escolar, em um só lugar.</h1>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] lg:text-lg">Acesse horários, alunos, ocorrências, notificações e as ferramentas de gestão do LogZélia.</p>
            </div>
          </div>
          <p className="text-xs font-medium text-white/70 drop-shadow-md">LogZélia · Sistema de gestão escolar</p>
        </div>
      </section>

      <section className="relative min-h-screen flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 md:flex md:items-center md:justify-center">
        <div className="relative h-[48svh] min-h-[340px] max-h-[500px] w-full overflow-hidden md:hidden">
          <img src={bgImg} alt="Escola" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/45 via-green-800/60 to-slate-950/85" />
          <div className="relative z-10 flex h-full flex-col justify-between px-5 pb-12 pt-5 sm:px-6 sm:pb-14">
            <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-black/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/25"><FaArrowLeft className="text-xs" /> Início</Link>
            <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
              <img src={logo} alt="Log Zélia" className="w-56 object-contain drop-shadow-2xl sm:w-64" />
              <p className="mt-3 text-sm font-medium text-white/80">Sistema de gestão escolar</p>
            </div>
          </div>
        </div>

        <div className="relative z-20 -mt-16 w-full px-4 pb-8 sm:px-6 md:mt-0 md:max-w-md md:px-0 md:pb-0">
          <div className="rounded-[2rem] border border-white bg-white/95 p-5 shadow-[0_-20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-7 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0 dark:border-slate-800 dark:bg-slate-900/95 md:dark:bg-transparent">
            <div className="mb-7 md:mb-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700 md:hidden dark:bg-green-950/50 dark:text-green-300"><FaSignInAlt /></div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Área restrita</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Entrar no LogZélia</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Use suas credenciais para acessar o ambiente da escola.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</label><FormInput type="email" placeholder="seu@email.com" onChange={(e) => setEmail(e.target.value)} className="w-full" disabled={submitting} /></div>
              <div><label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Senha</label><div className="relative"><FormInput type={showPassword ? "text" : "password"} placeholder="Sua senha" onChange={(e) => setSenha(e.target.value)} className="w-full pr-12" disabled={submitting} /><button type="button" disabled={submitting} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:hover:bg-slate-800 dark:hover:text-slate-200">{showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}</button></div></div>
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
