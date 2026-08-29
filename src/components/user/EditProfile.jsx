import { useState, useEffect } from "react"
import { useAuth } from "../../hooks/useAuth"
import { uploadAvatar } from "../../utils/uploadAvatar"
import { supabase } from "../../utils/supabase"
import { Button } from "../ui/Button"
import { FormInput } from "../ui/FormInput"
import { FaUser } from "react-icons/fa"

export const EditProfile = () => {
  const { user, refreshUser } = useAuth()

  const [nome, setNome] = useState("")
  const [loadingNome, setLoadingNome] = useState(false)
  const [errorNome, setErrorNome] = useState(null)
  const [successNome, setSuccessNome] = useState(null)

  const [loadingAvatar, setLoadingAvatar] = useState(false)
  const [errorAvatar, setErrorAvatar] = useState(null)
  const [successAvatar, setSuccessAvatar] = useState(null)

  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [loadingSenha, setLoadingSenha] = useState(false)
  const [errorSenha, setErrorSenha] = useState(null)
  const [successSenha, setSuccessSenha] = useState(null)

  useEffect(() => {
    if (user?.nome) {
      setNome(user.nome)
    }
  }, [user?.nome])

  async function handleSaveNome() {
    if (!nome.trim()) {
      setErrorNome("O nome não pode estar vazio")
      return
    }

    setLoadingNome(true)
    setErrorNome(null)
    setSuccessNome(null)

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome })
        .eq("id", user.id)

      if (error) {
        throw error
      }

      await refreshUser()

      setSuccessNome("Alterações salvas")

      setTimeout(() => {
        setSuccessNome(null)
      }, 3000)
    } catch {
      setErrorNome("Erro ao salvar")
    } finally {
      setLoadingNome(false)
    }
  }

  async function handleSaveAvatar(e) {
    const file = e.target.files?.[0]

    if (!file) return

    setLoadingAvatar(true)
    setErrorAvatar(null)
    setSuccessAvatar(null)

    try {
      const publicUrl = await uploadAvatar(file)

      if (!publicUrl) {
        throw new Error()
      }

      await refreshUser()

      setSuccessAvatar("Foto atualizada")

      setTimeout(() => {
        setSuccessAvatar(null)
      }, 3000)
    } catch {
      setErrorAvatar("Erro ao enviar foto")
    } finally {
      setLoadingAvatar(false)
      e.target.value = ""
    }
  }

  async function handleSaveSenha() {
    if (!novaSenha || !confirmarSenha) {
      setErrorSenha("Preencha os campos")
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErrorSenha("Senhas não coincidem")
      return
    }

    if (novaSenha.length < 6) {
      setErrorSenha("Mínimo 6 caracteres")
      return
    }

    setLoadingSenha(true)
    setErrorSenha(null)
    setSuccessSenha(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (error) {
        throw error
      }

      setSuccessSenha("Senha atualizada")
      setNovaSenha("")
      setConfirmarSenha("")

      setTimeout(() => {
        setSuccessSenha(null)
      }, 3000)
    } catch {
      setErrorSenha("Erro ao atualizar senha")
    } finally {
      setLoadingSenha(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900 dark:text-white">
        Foto de perfil
      </h1>

      <div className="mb-8 flex flex-col items-center gap-3">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="Avatar"
            className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-200 dark:ring-slate-800"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
            <FaUser
              size={32}
              className="text-slate-500 dark:text-slate-400"
            />
          </div>
        )}

        <label className="cursor-pointer text-sm font-medium text-green-700 hover:underline dark:text-green-400">
          {loadingAvatar
            ? "Enviando..."
            : "Alterar foto de perfil"}

          <FormInput
            type="file"
            accept="image/*"
            onChange={handleSaveAvatar}
            className="hidden"
          />
        </label>

        {errorAvatar && (
          <p className="text-sm text-red-500">
            {errorAvatar}
          </p>
        )}

        {successAvatar && (
          <p className="text-sm text-green-500">
            {successAvatar}
          </p>
        )}
      </div>

      <div className="space-y-4 border-t-[1px] border-slate-300 pt-6 dark:border-slate-700">
        <FormInput
          label="Nome"
          value={nome}
          onChange={(e) =>
            setNome(e.target.value)
          }
        />

        <Button
          onClick={handleSaveNome}
          disabled={loadingNome}
          className="w-full"
        >
          {loadingNome
            ? "Salvando..."
            : "Salvar alterações"}
        </Button>

        {errorNome && (
          <p className="text-sm text-red-500">
            {errorNome}
          </p>
        )}

        {successNome && (
          <p className="text-sm text-green-500">
            {successNome}
          </p>
        )}
      </div>

      <div className="mt-8 space-y-4 border-t-[1px] border-slate-300 pt-6 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Alterar senha
        </h2>

        <FormInput
          type="password"
          label="Nova senha"
          placeholder="Digite a nova senha"
          value={novaSenha}
          onChange={(e) =>
            setNovaSenha(e.target.value)
          }
        />

        <FormInput
          type="password"
          label="Confirmar senha"
          placeholder="Confirme a nova senha"
          value={confirmarSenha}
          onChange={(e) =>
            setConfirmarSenha(
              e.target.value
            )
          }
        />

        <Button
          onClick={handleSaveSenha}
          disabled={loadingSenha}
          className="w-full"
        >
          {loadingSenha
            ? "Alterando..."
            : "Alterar senha"}
        </Button>

        {errorSenha && (
          <p className="text-sm text-red-500">
            {errorSenha}
          </p>
        )}

        {successSenha && (
          <p className="text-sm text-green-500">
            {successSenha}
          </p>
        )}
      </div>
    </div>
  )
}