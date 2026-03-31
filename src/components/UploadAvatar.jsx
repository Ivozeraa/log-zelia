import { uploadAvatar } from "../utils/uploadAvatar"

export function UploadAvatar(){

  async function handleChange(e){

    const file = e.target.files[0]

    await uploadAvatar(file)

    window.location.reload()
  }

  return (
    <input
      type="file"
      accept="image/*"
      onChange={handleChange}
    />
  )
}