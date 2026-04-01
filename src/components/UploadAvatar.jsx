import { uploadAvatar } from "../utils/uploadAvatar"
import { useAuth } from "../hooks/useAuth"

export function UploadAvatar(){
  const { refreshUser } = useAuth()

  async function handleChange(e){
    const file = e.target.files[0]
    if(!file) return

    await uploadAvatar(file)
    await refreshUser()
  }

  return (
    <input
      type="file"
      accept="image/*"
      onChange={handleChange}
    />
  )
}