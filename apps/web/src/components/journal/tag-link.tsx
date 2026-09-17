import { formatCount } from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";

interface TagLinkProps {
  count?: number;
  large?: boolean;
  tag: string;
}

export function TagLink({ tag, count, large = false }: TagLinkProps) {
  return (
    <Link
      className="tag-chip"
      data-large={large ? "true" : undefined}
      params={{ tag }}
      to="/tag/$tag"
    >
      {tag}
      {count === undefined ? null : <em>{formatCount(count)}</em>}
    </Link>
  );
}
