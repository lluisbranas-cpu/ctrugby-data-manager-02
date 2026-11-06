type UploadResult = { error: unknown };

export function uploadErrorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const details = error as { statusCode?: string | number; status?: number };
  return Number(details.statusCode ?? details.status ?? 0) || 0;
}

// Upserts can be retried safely after a transient network or storage failure.
// Authentication/permission failures must stop immediately.
export async function retryStorageUpload<T extends UploadResult>(
  upload: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await upload();
    const status = uploadErrorStatus(result.error);
    if (!result.error || attempt === 2 || (status > 0 && status !== 429 && status < 500)) return result;
    await wait(500 * (attempt + 1));
  }
}
