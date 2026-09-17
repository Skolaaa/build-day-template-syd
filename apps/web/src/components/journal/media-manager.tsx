import {
  CAPTION_MAX_LENGTH,
  type Entry,
  isMediaContentType,
  MEDIA_MAX_BYTES,
  type MediaRef,
  mediaKindFor,
} from "@repo/mongo/shared";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { deleteMedia, posterFrameFor, uploadMedia } from "#/lib/media-upload";
import { updateMediaFn } from "#/server/journal";
import { MediaPlayer } from "./media-gallery";

const ACCEPT =
  "video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp";
const MEGABYTE = 1024 * 1024;
const CAPTION_DEBOUNCE_MS = 700;

interface PendingUpload {
  error: string | null;
  id: string;
  name: string;
  previewUrl: string;
  progress: number;
}

interface MediaManagerProps {
  enabled: boolean;
  /** Makes sure the page exists (uploads are keyed by its id) and returns it. */
  ensureEntry: () => Promise<Entry>;
  entry: Entry | null;
  onChange: (entry: Entry) => void;
}

/** Drag-and-drop or pick a file, watch it upload, caption it, reorder it. */
export function MediaManager({
  enabled,
  ensureEntry,
  entry,
  onChange,
}: MediaManagerProps) {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const media = entry?.media ?? [];

  // Preview URLs are object URLs; every one made here is revoked on unmount.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const startUpload = useCallback(
    async (file: File) => {
      setError(null);
      if (!isMediaContentType(file.type)) {
        setError(
          `${file.name} is not a kind of file the shelf keeps (mp4, webm, mov, jpg, png, webp).`
        );
        return;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        setError(
          `${file.name} is ${Math.round(file.size / MEGABYTE)} MB; the limit is ${MEDIA_MAX_BYTES / MEGABYTE} MB.`
        );
        return;
      }
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      previews.current.add(previewUrl);
      setUploads((current) => [
        ...current,
        { error: null, id, name: file.name, previewUrl, progress: 0 },
      ]);
      const update = (patch: Partial<PendingUpload>) =>
        setUploads((current) =>
          current.map((u) => (u.id === id ? { ...u, ...patch } : u))
        );
      try {
        const page = await ensureEntry();
        const result = await uploadMedia({
          entryId: page.id,
          file,
          filename: file.name,
          onProgress: (fraction) => update({ progress: fraction }),
        });
        onChange(result.entry);
        setUploads((current) => current.filter((u) => u.id !== id));
        URL.revokeObjectURL(previewUrl);
        previews.current.delete(previewUrl);
        if (mediaKindFor(file.type) === "video") {
          await attachPoster(page.id, result.media, file, onChange);
        }
      } catch (err) {
        update({
          error: err instanceof Error ? err.message : "The upload failed.",
        });
      }
    },
    [ensureEntry, onChange]
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files) {
        return;
      }
      for (const file of files) {
        startUpload(file);
      }
    },
    [startUpload]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      onFiles(event.dataTransfer.files);
    },
    [onFiles]
  );

  const onPick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onFiles(event.target.files);
      event.target.value = "";
    },
    [onFiles]
  );

  const remove = useCallback(
    async (item: MediaRef) => {
      setError(null);
      try {
        onChange(await deleteMedia(item.key));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not remove the clip."
        );
      }
    },
    [onChange]
  );

  // Captions and order are one list on the page; save the whole list, debounced.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveList = useCallback(
    (list: MediaRef[]) => {
      if (!entry) {
        return;
      }
      onChange({ ...entry, media: list });
      if (pending.current) {
        clearTimeout(pending.current);
      }
      pending.current = setTimeout(async () => {
        try {
          onChange(
            await updateMediaFn({
              data: {
                date: entry.date,
                media: list.map((m) => ({
                  caption: m.caption ?? "",
                  id: m.id,
                })),
              },
            })
          );
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Could not save the captions."
          );
        }
      }, CAPTION_DEBOUNCE_MS);
    },
    [entry, onChange]
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= media.length) {
      return;
    }
    const list = [...media];
    const [item] = list.splice(index, 1);
    if (item) {
      list.splice(target, 0, item);
    }
    saveList(list);
  };

  const caption = (index: number, text: string) => {
    saveList(media.map((m, i) => (i === index ? { ...m, caption: text } : m)));
  };

  if (!enabled) {
    return (
      <p className="m-0 text-[13.5px] text-ink-faint">
        Video and photos need an R2 bucket, which this deployment does not have
        yet. Words only for now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {media.map((item, index) => (
        <figure className="media-frame m-0" key={item.id}>
          <MediaPlayer item={item} />
          <div className="flex flex-wrap items-center gap-2 p-2">
            <Input
              aria-label="Caption"
              className="min-w-[200px] flex-1 font-serif italic"
              maxLength={CAPTION_MAX_LENGTH}
              onChange={(event) => caption(index, event.target.value)}
              placeholder="A caption, if you like"
              value={item.caption ?? ""}
            />
            <Button
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowUp />
            </Button>
            <Button
              aria-label="Move down"
              disabled={index === media.length - 1}
              onClick={() => move(index, 1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowDown />
            </Button>
            <Button
              aria-label="Remove"
              onClick={() => remove(item)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </div>
        </figure>
      ))}

      {uploads.map((upload) => (
        <div className="media-frame p-3" key={upload.id}>
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px] text-ink-soft">
            <span className="truncate">{upload.name}</span>
            <span className="tabular-nums">
              {upload.error ? "" : `${Math.round(upload.progress * 100)}%`}
            </span>
          </div>
          {upload.error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-[13px] text-accent" role="alert">
                {upload.error}
              </p>
              <Button
                onClick={() =>
                  setUploads((current) =>
                    current.filter((u) => u.id !== upload.id)
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div
              aria-label={`Uploading ${upload.name}`}
              className="upload-bar"
              role="progressbar"
            >
              <span
                style={{ width: `${Math.round(upload.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the drop target wraps a real button for keyboard users */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same */}
      <div
        className="dropzone"
        data-active={dragging ? "true" : undefined}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        <input
          accept={ACCEPT}
          className="sr-only"
          multiple
          onChange={onPick}
          ref={fileInput}
          type="file"
        />
        <Button
          onClick={() => fileInput.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Upload /> Add video or photo
        </Button>
        <p className="mt-2 mb-0 text-[12.5px]">
          or drop a file here · mp4, webm, mov, jpg, png, webp · up to{" "}
          {MEDIA_MAX_BYTES / MEGABYTE} MB
        </p>
      </div>

      {error ? (
        <p className="m-0 text-[13px] text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Best effort: a poster still makes the shelf nicer, but a clip without one is fine. */
async function attachPoster(
  entryId: string,
  clip: MediaRef,
  file: File,
  onChange: (entry: Entry) => void
) {
  const frame = await posterFrameFor(file);
  if (!frame) {
    return;
  }
  try {
    const result = await uploadMedia({
      entryId,
      file: frame,
      filename: "poster.jpg",
      onProgress: () => undefined,
      posterFor: clip.id,
    });
    onChange(result.entry);
  } catch {
    // The clip is already on the page; a missing poster is not worth an error.
  }
}
