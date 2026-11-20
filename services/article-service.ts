import type { Article, ArticleFormData } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'article-media'

// ----------------------------------------
// 1. Upload a file to Supabase Storage
// ----------------------------------------

async function uploadArticleFile(
  supabase: SupabaseClient,
  file: File,
  userId: string,
  folder: string
): Promise<string> {
  const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'file'

  const filePath = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false
    })

  if (error) {
    throw new Error(`Could not upload ${file.name}: ${error.message}`)
  }

  return filePath
}


// ----------------------------------------
// 2. Create a new article
// ----------------------------------------

export async function createArticle(
  supabase: SupabaseClient,
  formData: ArticleFormData
): Promise<Article> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('You must be logged in to create an article.')
  }

  const uploadedPaths: string[] = []

  try {
    // Upload featured image
    let featuredImagePath: string | null = null

    if (formData.featuredImage instanceof File) {
      featuredImagePath = await uploadArticleFile(
        supabase,
        formData.featuredImage as File,
        user.id,
        'featured'
      )

      uploadedPaths.push(featuredImagePath)
    }

    // Insert article
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .insert({
        title: formData.title,
        content: formData.content,
        category: formData.category,
        published: formData.published,
        featured_image_path: featuredImagePath,
        featured_image_caption: formData.featuredImageCaption,
        created_by: user.id
      })
      .select()
      .single()

    if (articleError) { console.log(articleError.message); throw articleError }

    // Upload and register attached files
    if (formData.attachedFiles.length > 0) {
      const attachmentRecords: Array<Record<string, string | number>> = []

      for (const file of formData.attachedFiles) {
        const filePath = await uploadArticleFile(
          supabase,
          file.file,
          user.id,
          `attachments/${article.id}`
        )

        uploadedPaths.push(filePath)

        attachmentRecords.push({
          article_id: article.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          caption: file.caption
        })
      }

      const { error: attachmentError } = await supabase
        .from('article_attachments')
        .insert(attachmentRecords)

      if (attachmentError) { console.log(attachmentError.message); throw attachmentError }
    }

    return article

  } catch (error) {
    // Clean up uploaded files if the operation fails
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths)
    }

    throw error
  }
}


// ----------------------------------------
// 3. Get all articles
// ----------------------------------------

export async function getArticles(
  supabase: SupabaseClient
): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      attachments:article_attachments(*)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as Article[]
}


// ----------------------------------------
// 4. Get a single article by ID
// ----------------------------------------

export async function getArticleById(
  supabase: SupabaseClient,
  id: string
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      attachments:article_attachments(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Article
}


// ----------------------------------------
// 5. Update an existing article
// ----------------------------------------

export async function updateArticle(
  supabase: SupabaseClient,
  id: string,
  formData: ArticleFormData
): Promise<Article> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('You must be logged in to update an article.')
  }

  const uploadedPaths: string[] = []

  try {
    // Upload a new featured image only when provided
    let featuredImagePath: string | undefined
    let previousFeaturedImagePath: string | null = null

    if (formData.removeFeaturedImage || formData.featuredImage instanceof File) {
      const { data: existingArticle, error: existingArticleError } = await supabase
        .from('articles')
        .select('featured_image_path')
        .eq('id', id)
        .single()
      if (existingArticleError) throw existingArticleError
      previousFeaturedImagePath = existingArticle.featured_image_path
    }

    if (formData.featuredImage instanceof File) {
      featuredImagePath = await uploadArticleFile(
        supabase,
        formData.featuredImage as File,
        user.id,
        'featured'
      )

      uploadedPaths.push(featuredImagePath)
    }

    const updateData: Partial<Article> = {
      title: formData.title,
      content: formData.content,
      category: formData.category,
      published: formData.published,
      featured_image_caption: formData.featuredImageCaption,
      updated_at: new Date().toISOString()
    }

    // Preserve the previous image if no new image was selected
    if (featuredImagePath) {
      updateData.featured_image_path = featuredImagePath
    } else if (formData.removeFeaturedImage) {
      updateData.featured_image_path = null
    }

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (articleError) throw articleError

    if (previousFeaturedImagePath && (featuredImagePath || formData.removeFeaturedImage)) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([previousFeaturedImagePath])
      if (storageError) console.error('Article updated, but the previous featured image remains in storage:', storageError)
    }

    // Add newly attached files without deleting existing attachments
    if (formData.attachedFiles.length > 0) {
      const attachmentRecords: Array<Record<string, string | number>> = []

      for (const file of formData.attachedFiles) {
        const filePath = await uploadArticleFile(
          supabase,
          file.file,
          user.id,
          `attachments/${id}`
        )

        uploadedPaths.push(filePath)

        attachmentRecords.push({
          article_id: id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          caption: file.caption
        })
      }

      const { error: attachmentError } = await supabase
        .from('article_attachments')
        .insert(attachmentRecords)

      if (attachmentError) throw attachmentError
    }

    return article

  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths)
    }

    throw error
  }
}


// ----------------------------------------
// 6. Delete an article
// ----------------------------------------

export async function deleteArticle(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Get all associated files
  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select(`
      featured_image_path,
      attachments:article_attachments(file_path)
    `)
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError
  if (!article) throw new Error('Article not found.')

  const filePaths = [
    ...(article.featured_image_path
      ? [article.featured_image_path]
      : []),

    ...(article.attachments || []).map(
      (attachment: { file_path: string }) => attachment.file_path
    )
  ]

  // Delete the article (attachments are deleted through ON DELETE CASCADE)
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError

  // Remove files from Storage
  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove(filePaths)

    if (storageError) {
      console.error('Article deleted, but some storage files remain:', storageError)
    }
  }
}


// ----------------------------------------
// 7. Get public URL for an article file
// ----------------------------------------

export function getArticleFileUrl(
  supabase: SupabaseClient,
  filePath: string
): string {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}


// ----------------------------------------
// 8. Delete an individual attachment
// ----------------------------------------

export async function deleteArticleAttachment(
  supabase: SupabaseClient,
  attachmentId: string
): Promise<void> {
  const { data: attachment, error: fetchError } = await supabase
    .from('article_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .single()

  if (fetchError) throw fetchError
  if (!attachment) throw new Error('Article attachment not found.')
  if (!attachment) throw new Error('Article attachment not found.')

  const { error: deleteError } = await supabase
    .from('article_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) throw deleteError

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.file_path])

  if (storageError) throw storageError
}