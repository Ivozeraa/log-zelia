import { supabase } from "./supabase"

export async function uploadAvatar(file){

  const { data } = await supabase.auth.getUser()

  const user = data.user

  if(!user || !file) return

  const ext = file.name.split(".").pop()

  const filePath = `${user.id}.${ext}`

  const { error: uploadError } = await supabase
    .storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    })

  if(uploadError){
    console.error(uploadError)
    return
  }

  const { data: publicUrlData } = supabase
    .storage
    .from("avatars")
    .getPublicUrl(filePath)

  const publicUrl = publicUrlData?.publicUrl
  if(!publicUrl){
    console.error("Não foi possível gerar URL pública do avatar")
    return null
  }

  await supabase.auth.updateUser({
    data:{
      avatar_url: publicUrl
    }
  })

  return publicUrl
}
