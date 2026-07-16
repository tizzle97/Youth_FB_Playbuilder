// Client-side image downscaling so users can upload photos straight off
// their phone (3–12MB originals) without ever seeing a size error. The
// avatars bucket keeps its 2MB server-side limit as a backstop; files
// processed here land far below it (~50–200KB).

/** Sanity cap on what we'll even attempt to read — stops accidental videos
 *  and multi-hundred-MB scans, not real photos. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function assertReasonableUpload(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is over 25MB — please choose a smaller photo.');
  }
}

/**
 * Downscale an image so its longest edge is at most `maxDim` pixels and
 * re-encode it. PNGs stay PNG (preserves logo transparency); everything
 * else becomes JPEG. Images already within bounds are still re-encoded,
 * which strips megabytes of camera metadata and inflated quality settings.
 */
export async function downscaleImage(file: Blob, maxDim: number, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image — try a JPEG or PNG.'));
      el.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image in this browser.');
    ctx.drawImage(img, 0, 0, width, height);

    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === 'image/jpeg' ? quality : undefined),
    );
    if (!blob) throw new Error('Could not process that image in this browser.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
