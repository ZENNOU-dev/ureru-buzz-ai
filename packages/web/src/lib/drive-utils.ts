/**
 * Google Drive の共有URLからファイルIDを抽出する
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  // https://drive.google.com/file/d/{ID}/view?...
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match?.[1] ?? null;
}

export function driveThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
