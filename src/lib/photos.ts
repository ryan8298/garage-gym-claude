import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type ProgressPhoto } from './db'
import { supabase } from './supabase'
import { requestSync } from './syncRunner'

const BUCKET = 'progress-photos'

/** Shrink a photo on the phone before it is uploaded: longest side 1280px, JPEG. */
export async function compress(file: File, max = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', quality))
}

/** Upload needs a connection. Returns an error message, or null when saved. */
export async function addPhoto(userId: string, date: string, file: File): Promise<string | null> {
  if (!supabase) return 'The app is not connected to a database.'
  if (!navigator.onLine) return 'Photos need a connection. Try again when you have signal.'
  try {
    const id = crypto.randomUUID()
    const path = `${userId}/${date}_${id}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, await compress(file), { contentType: 'image/jpeg' })
    if (error) return error.message
    await save<ProgressPhoto>(db, 'progress_photos', { id, user_id: userId, taken_on: date, path })
    requestSync(0)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

export async function removePhoto(photo: ProgressPhoto) {
  const { updated_at: _u, synced_at: _s, ...rest } = photo
  await save<ProgressPhoto>(db, 'progress_photos', { ...rest, deleted: true })
  requestSync(0)
  void supabase?.storage.from(BUCKET).remove([photo.path])
}

export const usePhotos = (userId: string) =>
  useLiveQuery(async () => (await db.progress_photos.where('user_id').equals(userId).toArray()).filter((p) => !p.deleted).sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1)), [userId], [] as ProgressPhoto[])

/** Short-lived private links for a set of photos. Photos are never public. */
export function useSignedUrls(photos: ProgressPhoto[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const paths = photos.map((p) => p.path).join('|')
  useEffect(() => {
    if (!supabase || !paths || !navigator.onLine) return
    let live = true
    void supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths.split('|'), 3600)
      .then(({ data }) => {
        if (live && data) setUrls(Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string])))
      })
    return () => {
      live = false
    }
  }, [paths])
  return urls
}
