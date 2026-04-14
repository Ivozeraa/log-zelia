import { useState, useEffect } from "react"
import { useAuth } from "../hooks/useAuth"
import { uploadAvatar } from "../utils/uploadAvatar"
import { supabase } from "../utils/supabase"
import { FaUser, FaCamera, FaSave, FaKey } from "react-icons/fa"

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

      if (error) throw error

      await refreshUser()
      setSuccessNome("Nome atualizado com sucesso!")
      setTimeout(() => setSuccessNome(null), 3000)
    } catch (err) {
      console.error("Erro ao atualizar nome:", err)
      setErrorNome("Falha ao atualizar nome")
    } finally {
      setLoadingNome(false)
    }
  }

  async function handleSaveAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("Arquivo selecionado:", file.name, "Tipo:", file.type, "Tamanho:", file.size)
    setLoadingAvatar(true)
    setErrorAvatar(null)
    setSuccessAvatar(null)

    try {
      const publicUrl = await uploadAvatar(file)
      if (!publicUrl) throw new Error("Upload falhou")
      
      await refreshUser()
      setSuccessAvatar("Avatar atualizado com sucesso!")
      setTimeout(() => setSuccessAvatar(null), 3000)
    } catch (err) {
      console.error("Falha upload avatar:", err)
      setErrorAvatar(`Falha ao enviar a foto: ${err.message}`)
    } finally {
      setLoadingAvatar(false)
      e.target.value = ""
    }
  }

  async function handleSaveSenha() {
    if (!novaSenha.trim() || !confirmarSenha.trim()) {
      setErrorSenha("Preencha a nova senha e confirmação")
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErrorSenha("A nova senha e a confirmação não coincidem")
      return
    }

    if (novaSenha.length < 6) {
      setErrorSenha("A nova senha deve ter pelo menos 6 caracteres")
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

      setSuccessSenha("Senha atualizada com sucesso!")
      setNovaSenha("")
      setConfirmarSenha("")
      setTimeout(() => setSuccessSenha(null), 3000)
    } catch (err) {
      console.error("Erro ao atualizar senha:", err)
      setErrorSenha("Falha ao atualizar senha")
    } finally {
      setLoadingSenha(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-2">
        <FaUser />
        Editar Perfil
      </h1>

     
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-700">
          <FaUser />
          Alterar Nome
        </h2>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Novo nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Digite seu nome"
          />
        </div>
        <button
          onClick={handleSaveNome}
          disabled={loadingNome}
          className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <FaSave />
          {loadingNome ? "Salvando..." : "Salvar Nome"}
        </button>
        {errorNome && <p className="text-red-600 text-center bg-red-50 p-3 rounded-lg mt-3">{errorNome}</p>}
        {successNome && <p className="text-green-600 text-center bg-green-50 p-3 rounded-lg mt-3">{successNome}</p>}
      </div>


      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-700">
          <FaCamera />
          Alterar Foto
        </h2>
        <div className="flex justify-center mb-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="Avatar atual"
              className="w-24 h-24 rounded-full object-cover border-4 border-green-300"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
              <FaUser size={32} className="text-gray-400" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Selecione uma nova foto
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleSaveAvatar}
            disabled={loadingAvatar}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        {loadingAvatar && <p className="text-blue-600 text-center mt-3">Enviando foto...</p>}
        {errorAvatar && <p className="text-red-600 text-center bg-red-50 p-3 rounded-lg mt-3">{errorAvatar}</p>}
        {successAvatar && <p className="text-green-600 text-center bg-green-50 p-3 rounded-lg mt-3">{successAvatar}</p>}
      </div>

      {/* SEÇÃO DE ALTERAÇÃO DE SENHA */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-700">
          <FaKey />
          Alterar Senha
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Nova senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="Digite a nova senha (mínimo 6 caracteres)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              placeholder="Confirme a nova senha"
            />
          </div>
        </div>
        <button
          onClick={handleSaveSenha}
          disabled={loadingSenha}
          className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <FaKey />
          {loadingSenha ? "Alterando..." : "Alterar Senha"}
        </button>
        {errorSenha && <p className="text-red-600 text-center bg-red-50 p-3 rounded-lg mt-3">{errorSenha}</p>}
        {successSenha && <p className="text-green-600 text-center bg-green-50 p-3 rounded-lg mt-3">{successSenha}</p>}
      </div>
    </div>
  )
}