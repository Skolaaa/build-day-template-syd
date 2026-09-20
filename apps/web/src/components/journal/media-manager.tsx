import {
  CAPTION_MAX_LENGTH,
  type Entry,
  MEDIA_MAX_BYTES,
  type MediaRef,
  mediaKindFor,
} from "@repo/mongo/shared";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Images,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "#/components/ui/input-group";
import { Item, ItemContent, ItemMedia, ItemTitle } from "#/components/ui/item";
import { Progress } from "#/components/ui/progress";
import { formatBytes, useFileUpload } from "#/hooks/use-file-upload";
import { deleteMedia, posterFrameFor, uploadMedia } from "#/lib/media-upload";
import { updateMediaFn } from "#/server/journal";
import { MediaPlayer } from "./media-gallery";

const ACCEPT =
  "video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp";
const CAPTION_DEBOUNCE_MS = 700;
const PERCENT = 100;

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
  const [error, setError] = useState<string | null>(null);
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
        if (mediaKindFor(result.media.contentType) === "video") {
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

  const onFilesAdded = useCallback(
    (files: File[]) => {
      for (const file of files) {
        startUpload(file);
      }
    },
    [startUpload]
  );

  const [{ errors, isDragging }, drop] = useFileUpload({
    accept: ACCEPT,
    maxSize: MEDIA_MAX_BYTES,
    multiple: true,
    onFilesAdded,
    rejectMessage: (file) =>
      `${file.name} is not a kind of file the shelf keeps (mp4, webm, mov, jpg, png, webp).`,
    sizeMessage: (file) =>
      `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(MEDIA_MAX_BYTES)}.`,
  });

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

  const problems = [...errors, ...(error ? [error] : [])];

  return (
    <div className="flex flex-col gap-4">
      {media.map((item, index) => (
        <figure className="media-frame m-0" key={item.id}>
          <MediaPlayer item={item} />
          <div className="p-2">
            <InputGroup className="bg-paper-raised">
              <InputGroupInput
                aria-label="Caption"
                className="font-serif italic"
                maxLength={CAPTION_MAX_LENGTH}
                onChange={(event) => caption(index, event.target.value)}
                placeholder="A caption, if you like"
                value={item.caption ?? ""}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  size="icon-xs"
                >
                  <ArrowUp />
                </InputGroupButton>
                <InputGroupButton
                  aria-label="Move down"
                  disabled={index === media.length - 1}
                  onClick={() => move(index, 1)}
                  size="icon-xs"
                >
                  <ArrowDown />
                </InputGroupButton>
                <InputGroupButton
                  aria-label="Remove"
                  className="text-ink-faint hover:text-accent"
                  onClick={() => remove(item)}
                  size="icon-xs"
                >
                  <Trash2 />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </figure>
      ))}

      {uploads.map((upload) => (
        <Item className="bg-paper-raised" key={upload.id} variant="outline">
          <ItemMedia className="text-ink-faint" variant="icon">
            {upload.error ? (
              <CircleAlert className="text-accent" />
            ) : (
              <Upload />
            )}
          </ItemMedia>
          <ItemContent className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <ItemTitle className="font-normal text-ink-soft">
                {upload.name}
              </ItemTitle>
              {upload.error ? (
                <Button
                  onClick={() =>
                    setUploads((current) =>
                      current.filter((u) => u.id !== upload.id)
                    )
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Dismiss
                </Button>
              ) : (
                <span className="text-[12px] text-ink-faint tabular-nums">
                  {Math.round(upload.progress * PERCENT)}%
                </span>
              )}
            </div>
            {upload.error ? (
              <p className="m-0 text-[13px] text-accent" role="alert">
                {upload.error}
              </p>
            ) : (
              <Progress
                aria-label={`Uploading ${upload.name}`}
                value={upload.progress * PERCENT}
              />
            )}
          </ItemContent>
        </Item>
      ))}

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the drop target wraps a real button for keyboard users */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same */}
      <div
        className="flex flex-col items-center rounded-xl border border-rule-strong border-dashed px-4 py-6 text-center transition-colors has-[input:focus-visible]:border-accent data-[dragging=true]:border-accent data-[dragging=true]:bg-paper-raised"
        data-dragging={isDragging || undefined}
        onDragEnter={drop.handleDragEnter}
        onDragLeave={drop.handleDragLeave}
        onDragOver={drop.handleDragOver}
        onDrop={drop.handleDrop}
      >
        <input
          {...drop.getInputProps()}
          aria-label="Add video or photos"
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className="mb-2 flex size-10 items-center justify-center rounded-full border border-rule bg-paper-raised text-ink-soft"
        >
          <Images className="size-4" />
        </span>
        <p className="m-0 mb-1 font-medium text-[14px] text-ink">
          Drop video or photos here
        </p>
        <p className="m-0 text-[12.5px] text-ink-faint">
          mp4, webm, mov, jpg, png or webp, up to {formatBytes(MEDIA_MAX_BYTES)}
        </p>
        <Button
          className="mt-4"
          onClick={drop.openFileDialog}
          size="sm"
          type="button"
          variant="outline"
        >
          <Upload data-icon="inline-start" />
          Choose files
        </Button>
      </div>

      {problems.map((problem) => (
        <p
          className="m-0 flex items-start gap-1.5 text-[13px] text-accent"
          key={problem}
          role="alert"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {problem}
        </p>
      ))}
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
