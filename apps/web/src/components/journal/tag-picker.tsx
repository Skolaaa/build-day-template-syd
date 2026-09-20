import {
  normalizeTag,
  TAG_MAX_COUNT,
  TAG_MAX_LENGTH,
} from "@repo/mongo/shared";
import { Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/components/ui/popover";

const SUGGESTIONS_SHOWN = 8;

interface TagPickerProps {
  onChange: (tags: string[]) => void;
  /** Tags used on other pages, offered first. */
  suggestions: string[];
  value: string[];
}

/**
 * The page's tags as chips, and a small picker that offers the tags used
 * before or takes a new one. After Kibo UI's Tags: a Popover over a Command
 * list, so the keyboard does all of it.
 */
export function TagPicker({ onChange, suggestions, value }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = normalizeTag(query);
  const full = value.length >= TAG_MAX_COUNT;

  const add = (tag: string) => {
    const next = normalizeTag(tag);
    if (next.length === 0 || next.length > TAG_MAX_LENGTH || full) {
      return;
    }
    if (!value.includes(next)) {
      onChange([...value, next]);
    }
    setQuery("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const matches = suggestions
    .filter((tag) => !value.includes(tag))
    .filter((tag) => typed.length === 0 || tag.includes(typed))
    .slice(0, SUGGESTIONS_SHOWN);
  const canCreate =
    typed.length > 0 && !value.includes(typed) && !suggestions.includes(typed);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ",") {
      event.preventDefault();
      add(typed);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((tag) => (
        <Badge
          className="gap-1 pr-1 font-normal text-[12.5px] text-ink-soft"
          key={tag}
          variant="secondary"
        >
          {tag}
          <button
            aria-label={`Remove tag ${tag}`}
            className="inline-flex size-4 items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-accent"
            onClick={() => remove(tag)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className="h-7 text-ink-faint hover:text-ink"
            disabled={full}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Plus data-icon="inline-start" />
            {value.length === 0 ? "Add a tag" : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onKeyDown={onKeyDown}
              onValueChange={setQuery}
              placeholder="walks, family, work…"
              value={query}
            />
            <CommandList>
              {canCreate ? (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => add(typed)}
                    value={`create:${typed}`}
                  >
                    <Plus />
                    Add “{typed}”
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {matches.length > 0 ? (
                <CommandGroup heading="Used before">
                  {matches.map((tag) => (
                    <CommandItem
                      key={tag}
                      onSelect={() => add(tag)}
                      value={tag}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {!canCreate && matches.length === 0 ? (
                <CommandEmpty>
                  {typed.length === 0
                    ? "Type a tag and press enter."
                    : "Already on this page."}
                </CommandEmpty>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
