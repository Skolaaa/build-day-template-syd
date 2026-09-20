// Drag-and-drop and file-picker plumbing for the media manager: which
// files are acceptable, whether something is being dragged over the target,
// and the props the hidden input needs. After Origin UI's use-file-upload
// hook, cut down to validation and drag state; the journal keeps its own
// upload queue because uploads stream to R2 with progress.

import {
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";

export interface FileUploadOptions {
  /** A comma-separated accept list, as the input attribute takes it. */
  accept?: string;
  /** In bytes. */
  maxSize?: number;
  multiple?: boolean;
  /** Called with the files that passed validation. */
  onFilesAdded: (files: File[]) => void;
  /** What to say about a file the shelf does not keep. */
  rejectMessage?: (file: File) => string;
  /** What to say about a file that is too big. */
  sizeMessage?: (file: File) => string;
}

export interface FileUploadState {
  errors: string[];
  isDragging: boolean;
}

export interface FileUploadActions {
  addFiles: (files: FileList | File[]) => void;
  clearErrors: () => void;
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: RefObject<HTMLInputElement | null>;
  };
  handleDragEnter: (event: DragEvent<HTMLElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLElement>) => void;
  handleDragOver: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => void;
  openFileDialog: () => void;
}

const BYTES_PER_UNIT = 1024;
const UNITS = ["B", "KB", "MB", "GB"] as const;

/** "100 MB", the way a person says it. */
export function formatBytes(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= BYTES_PER_UNIT && unit < UNITS.length - 1) {
    size /= BYTES_PER_UNIT;
    unit += 1;
  }
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
}

function isAccepted(file: File, accept: string): boolean {
  if (accept === "*") {
    return true;
  }
  const extension = `.${file.name.split(".").pop() ?? ""}`.toLowerCase();
  return accept
    .split(",")
    .map((type) => type.trim())
    .some((type) => {
      if (type.startsWith(".")) {
        return extension === type.toLowerCase();
      }
      if (type.endsWith("/*")) {
        return file.type.startsWith(`${type.slice(0, -1)}`);
      }
      return file.type === type;
    });
}

export function useFileUpload({
  accept = "*",
  maxSize = Number.POSITIVE_INFINITY,
  multiple = false,
  onFilesAdded,
  rejectMessage = (file) =>
    `${file.name} is not a kind of file that is accepted.`,
  sizeMessage = (file) =>
    `${file.name} is larger than ${formatBytes(maxSize)}.`,
}: FileUploadOptions): [FileUploadState, FileUploadActions] {
  const [state, setState] = useState<FileUploadState>({
    errors: [],
    isDragging: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files = multiple ? [...incoming] : [...incoming].slice(0, 1);
      const errors: string[] = [];
      const accepted: File[] = [];
      for (const file of files) {
        if (!isAccepted(file, accept)) {
          errors.push(rejectMessage(file));
        } else if (file.size > maxSize) {
          errors.push(sizeMessage(file));
        } else {
          accepted.push(file);
        }
      }
      setState((current) => ({ ...current, errors }));
      if (accepted.length > 0) {
        onFilesAdded(accepted);
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [accept, maxSize, multiple, onFilesAdded, rejectMessage, sizeMessage]
  );

  const clearErrors = useCallback(() => {
    setState((current) => ({ ...current, errors: [] }));
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setState((current) => ({ ...current, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Leaving for a child of the target is not leaving the target.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setState((current) => ({ ...current, isDragging: false }));
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setState((current) => ({ ...current, isDragging: false }));
      if (inputRef.current?.disabled) {
        return;
      }
      if (event.dataTransfer.files.length > 0) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        addFiles(event.target.files);
      }
    },
    [addFiles]
  );

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({
      ...props,
      accept: props.accept ?? accept,
      multiple: props.multiple ?? multiple,
      onChange: handleFileChange,
      ref: inputRef,
      type: "file" as const,
    }),
    [accept, multiple, handleFileChange]
  );

  return [
    state,
    {
      addFiles,
      clearErrors,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
    },
  ];
}
