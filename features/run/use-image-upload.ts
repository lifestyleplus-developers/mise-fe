import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';

import { api } from '@/shared/api/client';
import { UPLOAD_TIMEOUT_MS } from '@/shared/api/with-timeout';

/**
 * Why an upload failed, as a code: screens decide what to say, in the person's
 * language. Never a message to show as it is.
 */
export type UploadError =
  'camera_permission_denied' | 'no_image' | 'upload_failed';

type UploadState = {
  uploading: boolean;
  key: string | null;
  url: string | null;
  error: UploadError | null;
};

type UseImageUploadOptions = {
  onSuccess?: (key: string, url: string) => void;
  onError?: (error: UploadError) => void;
};

/** Thrown inside `upload` so one catch turns every failure into a code. */
class UploadFailure extends Error {
  constructor(readonly code: UploadError) {
    super(code);
  }
}

/**
 * Handles live camera capture and direct upload to storage.
 * Live capture only — the gallery is never offered (FE Spec §7).
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [state, setState] = React.useState<UploadState>({
    uploading: false,
    key: null,
    url: null,
    error: null,
  });

  const upload = React.useCallback(
    async (taskId: number) => {
      try {
        setState((prev) => ({ ...prev, uploading: true, error: null }));

        // Request camera permissions
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          throw new UploadFailure('camera_permission_denied');
        }

        // Launch camera - live capture only, no gallery
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
          exif: false,
        });

        if (result.canceled) {
          setState((prev) => ({ ...prev, uploading: false }));
          return null;
        }

        const asset = result.assets[0];
        if (!asset) {
          throw new UploadFailure('no_image');
        }

        // The platform signs the exact size of the photograph into the upload, so
        // it must be the size of the file that is sent. `asset.fileSize` is not that
        // (it was 3.2 MB for a 1.0 MB file on Android), and `fetch(uri).blob()` gave
        // 14 bytes, so the size is read from the file itself.
        const info = await FileSystem.getInfoAsync(asset.uri);
        const size = info.exists ? info.size : 0;
        if (!size) {
          throw new UploadFailure('no_image');
        }

        // Get upload signature
        const sign = await api.uploads.sign({
          purpose: 'run_task',
          target_id: taskId,
          content_type: 'image/jpeg',
          content_length: size,
        });

        // The mock backend hands out `mock://` locations there is nothing to
        // PUT to; skip the transfer and keep the rest of the flow real.
        if (!sign.upload_url.startsWith('mock://')) {
          // The file is sent as it is, and the phone sets Content-Length from it;
          // sending the signed length by hand as well risks a duplicate header.
          const { 'Content-Length': _length, ...headers } = sign.headers;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timedOut = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new UploadFailure('upload_failed')),
              UPLOAD_TIMEOUT_MS,
            );
          });
          try {
            const response = await Promise.race([
              FileSystem.uploadAsync(sign.upload_url, asset.uri, {
                httpMethod: sign.method,
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: { 'Content-Type': 'image/jpeg', ...headers },
              }),
              timedOut,
            ]);
            if (response.status < 200 || response.status >= 300) {
              throw new UploadFailure('upload_failed');
            }
          } finally {
            clearTimeout(timer);
          }
        }

        setState((prev) => ({
          ...prev,
          uploading: false,
          key: sign.key,
          url: asset.uri,
          error: null,
        }));

        options.onSuccess?.(sign.key, asset.uri);
        return { key: sign.key, url: asset.uri };
      } catch (error) {
        // A refusal from the platform or a dropped connection is a failed upload.
        const message: UploadError =
          error instanceof UploadFailure ? error.code : 'upload_failed';
        setState((prev) => ({
          ...prev,
          uploading: false,
          error: message,
        }));
        options.onError?.(message);
        throw error;
      }
    },
    [options],
  );

  const reset = React.useCallback(() => {
    setState({
      uploading: false,
      key: null,
      url: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
}
