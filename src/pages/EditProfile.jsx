import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { uploadAvatar } from "../utils/uploadAvatar"
import { supabase } from "../utils/supabase"
import { FaUser, FaCamera, FaSave } from "react-icons/fa"

export const EditProfile = () => {
  const { user, refreshUser } = useAuth()
  const [nome, setNome] = useState(user?.nome || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome })
        .eq("id", user.id)

      if (error) throw error

      await refreshUser()
      setSuccess("Perfil atualizado com sucesso!")
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err)
      setError("Falha ao atualizar perfil")
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("Arquivo selecionado:", file.name, "Tipo:", file.type, "Tamanho:", file.size)
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const publicUrl = await uploadAvatar(file)
      if (!publicUrl) throw new Error("Upload falhou")
      await refreshUser()
      setSuccess("Avatar atualizado com sucesso!")
    } catch (err) {
      console.error("Falha upload avatar:", err)
      setError(`Falha ao enviar a foto: ${err.message}`)
    } finally {
      setLoading(false)
      e.target.value = "" // Limpar input
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-2">
        <FaUser />
        Editar Perfil
      </h1>

      {/* Avatar atual */}
      <div className="flex justify-center mb-6">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="Avatar atual"
            className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            <FaUser size={32} className="text-gray-400" />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <FaUser className="text-gray-500" />
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Digite seu nome"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <FaCamera className="text-gray-500" />
            Avatar
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <FaSave />
          {loading ? "Salvando..." : "Salvar"}
        </button>

        {error && <p className="text-red-600 text-center bg-red-50 p-3 rounded-lg">{error}</p>}
        {success && <p className="text-green-600 text-center bg-green-50 p-3 rounded-lg">{success}</p>}
      </div>
    </div>
  )
}