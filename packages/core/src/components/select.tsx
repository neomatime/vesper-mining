"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FloatingPanel } from "./floating-panel";

type Option = { value: string; label: string; disabled: boolean };

/** Reads the <option> elements out of the children, so every form keeps writing plain options. */
function readOptions(children: React.ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    if (child.type === Fragment || child.type === "optgroup") {
      options.push(...readOptions(props.children));
    } else if (child.type === "option") {
      const label = Children.toArray(props.children).join("");
      options.push({ value: props.value !== undefined ? String(props.value) : label, label, disabled: Boolean(props.disabled) });
    }
  });
  return options;
}

const valueDescriptor = typeof HTMLSelectElement === "undefined" ? undefined : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

/** Lists longer than this get a search box. */
const SEARCH_THRESHOLD = 7;

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & {
  "data-autofocus"?: boolean | string;
  /** Force the search box on or off. By default it appears when the list is long. */
  searchable?: boolean;
};

/**
 * The one dropdown in VESPER. It looks and behaves the same everywhere, is fully keyboard and screen
 * reader accessible, and adds a search box when the list is long. It is a drop-in for <select>: a native
 * select sits behind it and carries the value, so react-hook-form, labels and validation keep working.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, searchable, className = "", disabled, onChange, "aria-invalid": ariaInvalid, "data-autofocus": dataAutofocus, ...rest },
  forwardedRef,
) {
  const id = useId();
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const options = useMemo(() => readOptions(children), [children]);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => (needle ? options.filter((option) => option.value !== "" && option.label.toLowerCase().includes(needle)) : options), [options, needle]);
  const selected = options.find((option) => option.value === value);
  const placeholder = options.find((option) => option.value === "")?.label ?? "Choose";

  const attach = useCallback(
    (element: HTMLSelectElement | null) => {
      nativeRef.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
      if (!element || !valueDescriptor) return;
      if (!Object.prototype.hasOwnProperty.call(element, "value")) {
        // react-hook-form sets values straight on the element, so the visible control follows along.
        Object.defineProperty(element, "value", {
          configurable: true,
          get() {
            return valueDescriptor.get!.call(element);
          },
          set(next: string) {
            valueDescriptor.set!.call(element, next);
            setValue(valueDescriptor.get!.call(element));
          },
        });
        element.addEventListener("change", () => setValue(element.value));
      }
      setValue(element.value);
    },
    [forwardedRef],
  );

  // The native select can change underneath us (react-hook-form, a parent re-render), so check every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (nativeRef.current && nativeRef.current.value !== value) setValue(nativeRef.current.value);
  });

  const choose = (option: Option) => {
    if (option.disabled) return;
    const element = nativeRef.current;
    if (!element) return;
    element.value = option.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    setQuery("");
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    setActive(index);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (showSearch) searchRef.current?.focus();
      else listRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, visible]);

  const move = (direction: 1 | -1, from = active) => {
    if (visible.length === 0) return;
    let index = from;
    for (let step = 0; step < visible.length; step += 1) {
      index = (index + direction + visible.length) % visible.length;
      if (!visible[index].disabled) return setActive(index);
    }
  };

  const onListKey = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); move(1); break;
      case "ArrowUp": event.preventDefault(); move(-1); break;
      case "Home": event.preventDefault(); setActive(0); break;
      case "End": event.preventDefault(); setActive(Math.max(0, visible.length - 1)); break;
      case "Enter": event.preventDefault(); if (visible[active]) choose(visible[active]); break;
      case "Tab": close(); break;
      default:
        if (!showSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const now = Date.now();
          typed.current = { text: now - typed.current.at > 700 ? event.key.toLowerCase() : typed.current.text + event.key.toLowerCase(), at: now };
          const hit = visible.findIndex((option) => option.label.toLowerCase().startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  const onTriggerKey = (event: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const listId = `${id}-list`;
  const activeId = visible[active] ? `${id}-option-${active}` : undefined;
  const display = selected ? selected.label : value || placeholder;
  const isPlaceholder = !selected || selected.value === "";

  return (
    <span className={`select ${className}`} ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={`select__trigger ${isPlaceholder ? "select__trigger--placeholder" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={ariaInvalid}
        data-autofocus={dataAutofocus}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        <span className="select__value">{display}</span>
        <ChevronDown aria-hidden="true" className={`select__chevron ${open ? "select__chevron--open" : ""}`} />
      </button>

      <select ref={attach} className="select__native" aria-hidden="true" tabIndex={-1} disabled={disabled} onChange={onChange} {...rest}>
        {children}
      </select>

      <FloatingPanel anchor={anchorRef} open={open} onClose={close} matchWidth minWidth={180} className="select__panel">
        {showSearch ? (
          <div className="select__search">
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              inputMode="search"
              placeholder="Search"
              aria-label="Search the list"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onListKey}
            />
          </div>
        ) : null}
        <div ref={listRef} id={listId} role="listbox" tabIndex={showSearch ? -1 : 0} aria-activedescendant={showSearch ? undefined : activeId} className="select__list" onKeyDown={showSearch ? undefined : onListKey}>
          {visible.length === 0 ? (
            <p className="select__empty">Nothing matches “{query}”.</p>
          ) : (
            visible.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                className={`select__option ${index === active ? "select__option--active" : ""} ${option.value === "" ? "select__option--placeholder" : ""}`}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check aria-hidden="true" /> : null}
              </div>
            ))
          )}
        </div>
      </FloatingPanel>
    </span>
  );
});
