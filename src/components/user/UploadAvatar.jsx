import { uploadAvatar } from "../../utils/uploadAvatar"
import { useAuth } from "../../hooks/useAuth"
import { FormInput } from "../ui/FormInput"

export function UploadAvatar() {
  const { refreshUser } = useAuth()

  async function handleChange(e) {
    const file = e.target.files[0]
    if (!file) return

    await uploadAvatar(file)
    await refreshUser()
  }

  return (
    <FormInput
      type="file"
      accept="image/*"
      onChange={handleChange}
    />
  )
}