import { useState, useEffect } from "react"
import { useAuth } from "../../hooks/useAuth"
import { uploadAvatar } from "../../utils/uploadAvatar"
import { supabase } from "../../utils/supabase"
import { Button } from "../ui/button"
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
    if (user?.nome) setNome(user.nome)
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

      if (error) throw error

      await refreshUser()
      setSuccessNome("Alterações salvas")
      setTimeout(() => setSuccessNome(null), 3000)
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
      if (!publicUrl) throw new Error()

      await refreshUser()
      setSuccessAvatar("Foto atualizada")
      setTimeout(() => setSuccessAvatar(null), 3000)
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
        password: novaSenha
      })

      if (error) throw error

      setSuccessSenha("Senha atualizada")
      setNovaSenha("")
      setConfirmarSenha("")
      setTimeout(() => setSuccessSenha(null), 3000)
    } catch {
      setErrorSenha("Erro ao atualizar senha")
    } finally {
      setLoadingSenha(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200">

      <h1 className="text-2xl font-semibold mb-6 text-center">
         Foto de perfil
      </h1>

      <div className="flex flex-col items-center gap-3 mb-8">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            <FaUser size={32} className="text-gray-400" />
          </div>
        )}

        <label className="text-blue-500 text-sm font-medium cursor-pointer hover:underline">
          {loadingAvatar ? "Enviando..." : "Alterar foto de perfil"}
          <input
            type="file"
            accept="image/*"
            onChange={handleSaveAvatar}
            className="hidden"
          />
        </label>

        {errorAvatar && <p className="text-red-500 text-sm">{errorAvatar}</p>}
        {successAvatar && <p className="text-green-500 text-sm">{successAvatar}</p>}
      </div>

      <div className="border-t border-gray-200 pt-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>

        <Button
          onClick={handleSaveNome}
          disabled={loadingNome}
          className="w-full"
        >
          {loadingNome ? "Salvando..." : "Salvar alterações"}
        </Button>

        {errorNome && <p className="text-red-500 text-sm">{errorNome}</p>}
        {successNome && <p className="text-green-500 text-sm">{successNome}</p>}
      </div>

      <div className="border-t border-gray-200 mt-8 pt-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Alterar senha
        </h2>

        <input
          type="password"
          placeholder="Nova senha"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
        />

        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
        />

        <Button
          onClick={handleSaveSenha}
          disabled={loadingSenha}
          className="w-full"
        >
          {loadingSenha ? "Alterando..." : "Alterar senha"}
        </Button>

        {errorSenha && <p className="text-red-500 text-sm">{errorSenha}</p>}
        {successSenha && <p className="text-green-500 text-sm">{successSenha}</p>}
      </div>

    </div>
  )
}