import { useRef, useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { uploadAvatar } from "../utils/uploadAvatar"
import { FaRegUserCircle } from "react-icons/fa"

export const UserSidebar = ({ open }) => {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const publicUrl = await uploadAvatar(file)
      if (!publicUrl) throw new Error("Upload falhou")
      await refreshUser?.()
    } catch (err) {
      console.error("Falha upload avatar:", err)
      setError("Falha ao enviar a foto")
    } finally {
      setLoading(false)
      e.target.value = ""
    }
  }

  return (
    <div
      className={`flex flex-col items-center gap-5 p-10 
      fixed top-0 right-0 h-screen w-72 bg-white shadow-lg z-50
      transform transition-all duration-250 ease-in-out
      ${open ? "translate-x-0" : "translate-x-full"}`}
    >
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user?.nome || "Avatar"}
          className="w-20 h-20 rounded-full object-cover"
        />
      ) : (
        <FaRegUserCircle size={50} />
      )}

      <p className="text-xl font-bold">{user?.nome || "Usuário"}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 transition"
        disabled={loading}
      >
        {loading ? "Enviando..." : "Enviar foto"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}