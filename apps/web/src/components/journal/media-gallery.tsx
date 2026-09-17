import { type MediaRef, mediaUrl } from "@repo/mongo/shared";

/** Clips and stills as they appear on a page, read-only. */
export function MediaGallery({ media }: { media: MediaRef[] }) {
  if (media.length === 0) {
    return null;
  }
  return (
    <div className="my-8 flex flex-col gap-6">
      {media.map((item) => (
        <figure className="media-frame m-0" key={item.id}>
          <MediaPlayer item={item} />
          {item.caption ? (
            <figcaption className="media-caption">{item.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

export function MediaPlayer({ item }: { item: MediaRef }) {
  if (item.kind === "image") {
    return (
      <img
        alt={item.caption ?? ""}
        height={item.height}
        src={mediaUrl(item.key)}
        width={item.width}
      />
    );
  }
  return (
    // biome-ignore lint/a11y/useMediaCaption: captions are the reader's own words, shown under the clip
    <video
      aria-label={item.caption ?? "Video clip"}
      controls
      playsInline
      poster={item.posterKey ? mediaUrl(item.posterKey) : undefined}
      preload="metadata"
      src={mediaUrl(item.key)}
    />
  );
}
