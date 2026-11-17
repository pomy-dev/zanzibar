import { SupabaseClient } from "@supabase/supabase-js";

export async function uploadGeneralDocument(
  supabase: SupabaseClient,
  bucket_name: string,
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(bucket_name)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (error) throw error;
  return path;
}

export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl?.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}