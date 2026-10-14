import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';

import { api } from '@/shared/api/client';
import type { ApiErrorBody } from '@/shared/api/types';

type UploadState = {
  uploading: boolean;
  key: string | null;
  url: string | null;
  error: string | null;
};

type UseImageUploadOptions = {
  onSuccess?: (key: string, url: string) => void;
  onError?: (error: string) => void;
};

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
          throw new Error('Camera permission denied');
        }

        // Launch camera - live capture only, no gallery
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
          throw new Error('No image captured');
        }

        // Get upload signature
        const sign = await api.uploads.sign({
          purpose: 'run_task',
          target_id: taskId,
          content_type: 'image/jpeg',
        });

        // Upload directly to storage
        const response = await fetch(sign.upload_url, {
          method: sign.method,
          headers: {
            'Content-Type': 'image/jpeg',
            ...sign.headers,
          },
          body: await fetch(asset.uri).then((r) => r.blob()),
        });

        if (!response.ok) {
          throw new Error('Upload failed');
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
        const message =
          error instanceof Error
            ? error.message
            : ((error as { body?: ApiErrorBody })?.body?.error?.message ??
              'Upload failed');
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
