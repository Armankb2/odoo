import { useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Profile picture: shows the current image (or the initials fallback) and lets
 * the owner — or an admin — replace or remove it.
 *
 * The `<input type="file">` is hidden and driven by a real button. Browsers
 * render the native control differently on every platform and it cannot be
 * styled, so the usual approach is to hide it and click it programmatically.
 */
export function AvatarUploader({
  userId,
  avatarUrl,
  firstName,
  lastName,
  onChange,
}: {
  userId: number;
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  onChange: (avatarUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown while the upload is in flight so the new picture appears instantly
  // instead of after a round trip.
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? avatarUrl;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    // The server enforces both of these; checking here just avoids spending an
    // upload on a file that is going to be rejected.
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPEG, PNG or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That image is too large. The maximum is 5 MB.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const res = await api.post<{ avatarUrl: string }>(`/api/employees/${userId}/avatar`, body);
      onChange(res.avatarUrl);
      setPreview(null);
    } catch (err) {
      setPreview(null);
      setError((err as Error).message);
    } finally {
      // Releasing the object URL after the real one has taken over; leaving it
      // allocated leaks the file for as long as the page is open.
      URL.revokeObjectURL(localUrl);
      setBusy(false);
      // Without this, choosing the same file twice in a row fires no change
      // event and nothing happens.
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/api/employees/${userId}/avatar`);
      onChange(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="avatar-uploader">
      {shown ? (
        <img src={shown} alt="" className="avatar avatar-large" />
      ) : (
        <span className="avatar avatar-large avatar-fallback">
          {firstName[0]}
          {lastName[0]}
        </span>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      <div className="avatar-actions">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
        </button>
        {avatarUrl && (
          <button type="button" className="link-button" disabled={busy} onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
