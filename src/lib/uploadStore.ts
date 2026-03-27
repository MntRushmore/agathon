// Store for pending file uploads during client-side navigation.
// Uses window (not module state) so it survives HMR/Fast Refresh in development.
// No size limits unlike sessionStorage.

const KEY = '__agathon_pending_upload__';

export function setPendingUpload(data: string | string[]) {
  (window as any)[KEY] = data;
}

export function getPendingUpload(): string | string[] | null {
  return (window as any)[KEY] ?? null;
}

export function clearPendingUpload() {
  delete (window as any)[KEY];
}
