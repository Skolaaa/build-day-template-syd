import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PLUGINS = [remarkGfm];

/** A page's body. Rendered to React, so nothing the reader typed is injected as HTML. */
export function PageBody({ body }: { body: string }) {
  return (
    <div className="prose-page">
      <Markdown remarkPlugins={PLUGINS}>{body}</Markdown>
    </div>
  );
}
