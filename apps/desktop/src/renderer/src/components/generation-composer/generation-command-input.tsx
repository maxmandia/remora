import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  attachmentMediaFieldIds,
  type AttachmentMediaFieldId,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";

type AttachmentReferenceOption = {
  fieldId: AttachmentMediaFieldId;
  index: number;
  label: string;
};

type PromptMention = {
  end: number;
  query: string;
  start: number;
};

type PromptSelectionRange = {
  end: number;
  start: number;
};

const attachmentReferenceLabelPrefix = {
  images: "Image",
  videos: "Video",
  audios: "Audio",
} as const satisfies Record<AttachmentMediaFieldId, string>;

const promptMentionQueryPattern = /^[A-Za-z0-9]*$/;
const attachmentReferenceMenuMinWidthPx = 128;

export function GenerationCommandInput({
  prompt,
  attachmentMediaValue,
  onPromptChange,
}: {
  prompt: string;
  attachmentMediaValue: GenerationAttachmentMediaValue;
  onPromptChange: (prompt: string) => void;
}) {
  const mentionListId = useId();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretPositionRef = useRef<number | null>(null);
  const [selectionRange, setSelectionRange] =
    useState<PromptSelectionRange | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [dismissedMentionSignature, setDismissedMentionSignature] = useState<
    string | null
  >(null);
  const [highlightedOptionIndex, setHighlightedOptionIndex] = useState(0);
  const [mentionListLeft, setMentionListLeft] = useState(0);
  const attachmentReferenceOptions = useMemo(
    () => getAttachmentReferenceOptions(attachmentMediaValue),
    [attachmentMediaValue],
  );
  const activeMention =
    isInputFocused && selectionRange
      ? getActivePromptMention({
          prompt,
          selectionEnd: selectionRange.end,
          selectionStart: selectionRange.start,
        })
      : null;
  const activeMentionSignature = activeMention
    ? getPromptMentionSignature(activeMention)
    : null;
  const activeMentionStart = activeMention?.start ?? null;
  const filteredReferenceOptions = activeMention
    ? getFilteredAttachmentReferenceOptions(
        attachmentReferenceOptions,
        activeMention.query,
      )
    : [];
  const shouldShowMentionList =
    Boolean(activeMention) &&
    activeMentionSignature !== dismissedMentionSignature &&
    filteredReferenceOptions.length > 0;
  const highlightedReferenceOption =
    filteredReferenceOptions[
      Math.min(highlightedOptionIndex, filteredReferenceOptions.length - 1)
    ] ?? null;
  const mentionListStyle = { left: mentionListLeft } satisfies CSSProperties;

  useEffect(() => {
    setHighlightedOptionIndex(0);
  }, [activeMentionSignature, filteredReferenceOptions.length]);

  useLayoutEffect(() => {
    const pendingCaretPosition = pendingCaretPositionRef.current;

    if (pendingCaretPosition === null) {
      return;
    }

    pendingCaretPositionRef.current = null;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(
      pendingCaretPosition,
      pendingCaretPosition,
    );
  }, [prompt]);

  useLayoutEffect(() => {
    const input = inputRef.current;

    if (!shouldShowMentionList || !input || activeMentionStart === null) {
      setMentionListLeft(0);
      return;
    }

    const characterIndex = activeMentionStart;
    const promptInput = input;

    function updateMentionListLeft() {
      const nextLeft = getAttachmentReferenceMenuLeft({
        characterIndex,
        input: promptInput,
      });

      setMentionListLeft((currentLeft) =>
        currentLeft === nextLeft ? currentLeft : nextLeft,
      );
    }

    updateMentionListLeft();

    const Observer = window.ResizeObserver;
    const resizeObserver =
      typeof Observer === "function"
        ? new Observer(updateMentionListLeft)
        : null;

    resizeObserver?.observe(promptInput);
    return () => resizeObserver?.disconnect();
  }, [activeMentionStart, prompt, shouldShowMentionList]);

  function updateSelectionRange(input: HTMLTextAreaElement) {
    const nextStart = input.selectionStart;
    const nextEnd = input.selectionEnd;

    if (nextStart === null || nextEnd === null) {
      setSelectionRange(null);
      return;
    }

    setSelectionRange({ start: nextStart, end: nextEnd });
  }

  function handlePromptChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onPromptChange(event.target.value);
    updateSelectionRange(event.target);
    setDismissedMentionSignature(null);
  }

  function handlePromptSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    updateSelectionRange(event.currentTarget);
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldShowMentionList || !activeMention) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedOptionIndex(
          (currentIndex) =>
            (currentIndex + 1) % filteredReferenceOptions.length,
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedOptionIndex(
          (currentIndex) =>
            (currentIndex - 1 + filteredReferenceOptions.length) %
            filteredReferenceOptions.length,
        );
        break;
      case "Enter":
      case "Tab":
        if (highlightedReferenceOption) {
          event.preventDefault();
          insertAttachmentReference(highlightedReferenceOption, activeMention);
        }
        break;
      case "Escape":
        event.preventDefault();
        setDismissedMentionSignature(getPromptMentionSignature(activeMention));
        break;
    }
  }

  function insertAttachmentReference(
    option: AttachmentReferenceOption,
    mention: PromptMention,
  ) {
    const insertedReference = `@${option.label} `;
    const suffixStart = isPromptTokenBoundary(prompt[mention.end] ?? "")
      ? mention.end + 1
      : mention.end;
    const nextPrompt = `${prompt.slice(0, mention.start)}${insertedReference}${prompt.slice(suffixStart)}`;
    const nextCaretPosition = mention.start + insertedReference.length;

    pendingCaretPositionRef.current = nextCaretPosition;
    setSelectionRange({
      start: nextCaretPosition,
      end: nextCaretPosition,
    });
    setDismissedMentionSignature(null);
    onPromptChange(nextPrompt);
  }

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        aria-autocomplete="list"
        aria-controls={shouldShowMentionList ? mentionListId : undefined}
        aria-expanded={shouldShowMentionList}
        className="text-surface-strong-foreground block field-sizing-content max-h-[25dvh] min-h-10 w-full resize-none overflow-y-auto bg-transparent py-2 leading-6 font-light focus:outline-none"
        placeholder="A castle in the sky with..."
        rows={1}
        value={prompt}
        onBlur={() => setIsInputFocused(false)}
        onChange={handlePromptChange}
        onClick={handlePromptSelection}
        onFocus={(event) => {
          setIsInputFocused(true);
          updateSelectionRange(event.currentTarget);
        }}
        onKeyDown={handlePromptKeyDown}
        onKeyUp={handlePromptSelection}
        onSelect={handlePromptSelection}
      />
      {shouldShowMentionList && activeMention ? (
        <AttachmentReferenceList
          id={mentionListId}
          highlightedIndex={highlightedOptionIndex}
          options={filteredReferenceOptions}
          style={mentionListStyle}
          onOptionMouseDown={(event) => {
            event.preventDefault();
          }}
          onOptionSelect={(option) =>
            insertAttachmentReference(option, activeMention)
          }
        />
      ) : null}
    </div>
  );
}

function AttachmentReferenceList({
  highlightedIndex,
  id,
  options,
  style,
  onOptionMouseDown,
  onOptionSelect,
}: {
  highlightedIndex: number;
  id: string;
  options: AttachmentReferenceOption[];
  style: CSSProperties;
  onOptionMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
  onOptionSelect: (option: AttachmentReferenceOption) => void;
}) {
  return (
    <div
      className="bg-popover text-secondary-foreground ring-foreground/10 absolute top-full z-50 mt-1 min-w-32 rounded-lg p-1 shadow-md ring-1"
      data-slot="attachment-reference-menu"
      style={style}
    >
      <ul id={id} className="list-none" role="listbox">
        {options.map((option, index) => (
          <AttachmentReferenceOptionButton
            key={`${option.fieldId}:${option.index}`}
            isHighlighted={index === highlightedIndex}
            option={option}
            onMouseDown={onOptionMouseDown}
            onSelect={onOptionSelect}
          >
            {option.label}
          </AttachmentReferenceOptionButton>
        ))}
      </ul>
    </div>
  );
}

function AttachmentReferenceOptionButton({
  children,
  isHighlighted,
  option,
  onMouseDown,
  onSelect,
}: {
  children: ReactNode;
  isHighlighted: boolean;
  option: AttachmentReferenceOption;
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelect: (option: AttachmentReferenceOption) => void;
}) {
  return (
    <li role="presentation">
      <button
        aria-selected={isHighlighted}
        className="flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-left text-sm outline-hidden select-none hover:bg-[var(--surface-interactive-hover)] data-[highlighted=true]:bg-[var(--surface-interactive-hover)]"
        data-highlighted={isHighlighted}
        role="option"
        type="button"
        onClick={() => onSelect(option)}
        onMouseDown={onMouseDown}
      >
        {children}
      </button>
    </li>
  );
}

function getAttachmentReferenceOptions(
  attachmentMediaValue: GenerationAttachmentMediaValue,
): AttachmentReferenceOption[] {
  return attachmentMediaFieldIds.flatMap((fieldId) =>
    attachmentMediaValue[fieldId].map((_, index) => ({
      fieldId,
      index,
      label: `${attachmentReferenceLabelPrefix[fieldId]}${index + 1}`,
    })),
  );
}

function getFilteredAttachmentReferenceOptions(
  options: AttachmentReferenceOption[],
  query: string,
) {
  const normalizedQuery = query.toLowerCase();

  return options.filter((option) =>
    option.label.toLowerCase().includes(normalizedQuery),
  );
}

function getAttachmentReferenceMenuLeft({
  characterIndex,
  input,
}: {
  characterIndex: number;
  input: HTMLTextAreaElement;
}) {
  const unclampedLeft =
    measureTextareaCharacterLeft(input, characterIndex) - input.scrollLeft;
  const maxLeft = Math.max(
    0,
    input.clientWidth - attachmentReferenceMenuMinWidthPx,
  );

  return Math.round(Math.max(0, Math.min(unclampedLeft, maxLeft)));
}

function measureTextareaCharacterLeft(
  input: HTMLTextAreaElement,
  characterIndex: number,
) {
  const inputStyle = window.getComputedStyle(input);
  const inputRect = input.getBoundingClientRect();
  const horizontalBorderWidth =
    (parseFloat(inputStyle.borderLeftWidth) || 0) +
    (parseFloat(inputStyle.borderRightWidth) || 0);
  const measureWidth =
    input.clientWidth > 0
      ? input.clientWidth + horizontalBorderWidth
      : inputRect.width;
  const measure = document.createElement("div");
  const marker = document.createElement("span");

  measure.dataset.slot = "prompt-input-measure";
  measure.style.position = "fixed";
  measure.style.top = "-9999px";
  measure.style.left = "0";
  measure.style.visibility = "hidden";
  measure.style.boxSizing = "border-box";
  measure.style.width = `${measureWidth}px`;
  measure.style.borderTopWidth = inputStyle.borderTopWidth;
  measure.style.borderRightWidth = inputStyle.borderRightWidth;
  measure.style.borderBottomWidth = inputStyle.borderBottomWidth;
  measure.style.borderLeftWidth = inputStyle.borderLeftWidth;
  measure.style.borderTopStyle = inputStyle.borderTopStyle;
  measure.style.borderRightStyle = inputStyle.borderRightStyle;
  measure.style.borderBottomStyle = inputStyle.borderBottomStyle;
  measure.style.borderLeftStyle = inputStyle.borderLeftStyle;
  measure.style.paddingTop = inputStyle.paddingTop;
  measure.style.paddingRight = inputStyle.paddingRight;
  measure.style.paddingBottom = inputStyle.paddingBottom;
  measure.style.paddingLeft = inputStyle.paddingLeft;
  measure.style.font = inputStyle.font;
  measure.style.letterSpacing = inputStyle.letterSpacing;
  measure.style.lineHeight = inputStyle.lineHeight;
  measure.style.wordSpacing = inputStyle.wordSpacing;
  measure.style.textTransform = inputStyle.textTransform;
  measure.style.whiteSpace = "pre-wrap";
  measure.style.overflowWrap = "break-word";
  measure.style.overflow = "hidden";
  measure.style.wordBreak = inputStyle.wordBreak;
  measure.style.tabSize = inputStyle.tabSize;
  measure.style.direction = inputStyle.direction;
  measure.style.textAlign = inputStyle.textAlign;
  measure.textContent = input.value.slice(0, characterIndex);

  marker.dataset.slot = "prompt-mention-position-marker";
  marker.textContent = input.value[characterIndex] ?? "\u200b";
  measure.append(marker);

  document.body.append(measure);
  const left =
    marker.getBoundingClientRect().left - measure.getBoundingClientRect().left;
  measure.remove();

  return left;
}

function getActivePromptMention({
  prompt,
  selectionEnd,
  selectionStart,
}: {
  prompt: string;
  selectionEnd: number;
  selectionStart: number;
}): PromptMention | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const tokenStart = getPromptTokenStart(prompt, selectionStart);

  if (prompt[tokenStart] !== "@") {
    return null;
  }

  const query = prompt.slice(tokenStart + 1, selectionStart);

  if (!promptMentionQueryPattern.test(query)) {
    return null;
  }

  return {
    start: tokenStart,
    end: getPromptTokenEnd(prompt, selectionStart),
    query,
  };
}

function getPromptMentionSignature(mention: PromptMention) {
  return `${mention.start}:${mention.end}:${mention.query}`;
}

function getPromptTokenStart(prompt: string, selectionStart: number) {
  let tokenStart = selectionStart;

  while (tokenStart > 0 && !isPromptTokenBoundary(prompt[tokenStart - 1])) {
    tokenStart -= 1;
  }

  return tokenStart;
}

function getPromptTokenEnd(prompt: string, selectionStart: number) {
  let tokenEnd = selectionStart;

  while (tokenEnd < prompt.length && !isPromptTokenBoundary(prompt[tokenEnd])) {
    tokenEnd += 1;
  }

  return tokenEnd;
}

function isPromptTokenBoundary(character: string) {
  return /\s/.test(character);
}
