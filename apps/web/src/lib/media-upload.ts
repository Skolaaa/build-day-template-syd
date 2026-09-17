// Browser-side upload to the Hono media routes in server.ts. XHR rather than
// fetch because it is the only way to get upload progress events.

import type { Entry, MediaRef } from "@repo/mongo/shared";

export interface UploadResult {
  entry: Entry;
  media: MediaRef;
}

interface UploadOptions {
  entryId: string;
  file: Blob;
  filename: string;
  onProgress: (fraction: number) => void;
  /** When set, the upload is a poster still for this clip rather than a new one. */
  posterFor?: string;
  signal?: AbortSignal;
}

export function uploadMedia(options: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      entryId: options.entryId,
      filename: options.filename,
    });
    if (options.posterFor) {
      params.set("posterFor", options.posterFor);
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/media?${params.toString()}`);
    xhr.setRequestHeader("Content-Type", options.file.type);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress(event.loaded / event.total);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error("The upload finished but the reply made no sense."));
        }
        return;
      }
      reject(new Error(messageFor(xhr)));
    });
    xhr.addEventListener("error", () =>
      reject(
        new Error(
          "The upload failed before it finished. Check the connection and try again."
        )
      )
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
    options.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(options.file);
  });
}

function messageFor(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as { error?: string };
    if (body.error) {
      return body.error;
    }
  } catch {
    // Not JSON: fall through to the status line.
  }
  return `The upload was refused (${xhr.status}).`;
}

export async function deleteMedia(key: string): Promise<Entry> {
  const response = await fetch(`/api/media/${key}`, { method: "DELETE" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      body.error ?? `Could not remove the clip (${response.status}).`
    );
  }
  return (await response.json()) as Entry;
}

const POSTER_SEEK_SECONDS = 0.5;
const POSTER_MAX_WIDTH = 960;
const POSTER_QUALITY = 0.82;

/**
 * Draws the first seekable frame of a video to a canvas and returns it as a
 * JPEG, so the shelf can show a still instead of a black rectangle. Resolves
 * to null when the browser cannot decode the file (a .mov in Chrome, say).
 */
export function posterFrameFor(file: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const done = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(blob);
    };
    video.addEventListener("error", () => done(null));
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(POSTER_SEEK_SECONDS, video.duration / 2);
    });
    video.addEventListener("seeked", () => {
      const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        done(null);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => done(blob), "image/jpeg", POSTER_QUALITY);
    });
    video.src = url;
  });
}
