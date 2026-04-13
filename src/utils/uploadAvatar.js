import { supabase } from "./supabase";

export async function uploadAvatar(file) {
  const { data, error } = await supabase.auth.getUser();

  if(error || !data.user || !file){
    console.error("Usuário não autenticado ou arquivo inválido")
    return
  }

  const user = data.user

  const filePath = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error(uploadError);
    return;
  }

  const { data: signedData, error: urlError } = await supabase.storage
    .from("avatars")
    .createSignedUrl(filePath, 60 * 60);

  const publicUrl = publicUrlData?.publicUrl

  if(!publicUrl){
    console.error("Não foi possível gerar URL pública do avatar")
    return null
  }

  const avatarUrl = signedData.signedUrl;

  await supabase.auth.updateUser({
    data: {
      avatar_url: avatarUrl,
    },
  });

  return avatarUrl;
}
