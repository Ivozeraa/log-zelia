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

  const { data: publicUrl } = supabase
    .storage
    .from("avatars")
    .getPublicUrl(filePath)

  await supabase.auth.updateUser({
    data:{
      avatar_url: publicUrl.publicUrl
    }
  })

}