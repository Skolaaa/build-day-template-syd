import { formatCount } from "@repo/mongo/shared";
import { Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";

interface TagLinkProps {
  count?: number;
  large?: boolean;
  tag: string;
}

export function TagLink({ tag, count, large = false }: TagLinkProps) {
  return (
    <Badge
      asChild
      className={cn(
        "font-normal text-ink-soft no-underline hover:text-accent",
        large ? "h-7 gap-1.5 px-3 text-[13.5px]" : "text-[12px]"
      )}
      variant="secondary"
    >
      <Link params={{ tag }} to="/tag/$tag">
        {tag}
        {count === undefined ? null : (
          <span className="text-ink-faint tabular-nums">
            {formatCount(count)}
          </span>
        )}
      </Link>
    </Badge>
  );
}
