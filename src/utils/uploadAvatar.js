import { supabase } from "./supabase";

export async function uploadAvatar(file) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || !file) {
    console.error("Usuário não autenticado ou arquivo inválido");
    return null;
  }

  const user = data.user;

  const filePath = `${user.id}/avatar.png`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error(uploadError);
    return null;
  }

  const { data: publicData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = publicData.publicUrl + `?t=${Date.now()}`;

  await supabase.auth.updateUser({
    data: {
      avatar_url: avatarUrl,
    },
  });

  return avatarUrl;
}