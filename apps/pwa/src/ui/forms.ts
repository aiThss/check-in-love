import { icon, type IconName } from './icons/icons';

let fieldSeq = 0;

// ── Field (Input / Textarea with Inline Validation) ──────────────────────────

export interface FieldOptions {
  label: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'date';
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  value?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: IconName;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
  onInput?: (value: string) => void;
}

export interface FieldController {
  element: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement;
  getValue: () => string;
  setValue: (value: string) => void;
  setError: (message: string | null) => void;
}

export function createField(options: FieldOptions): FieldController {
  const id = `cil-field-${++fieldSeq}`;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  const root = document.createElement('div');
  root.className = `c-field${options.leadingIcon && !options.multiline ? ' c-field--has-leading' : ''}`;

  const label = document.createElement('label');
  label.className = 'c-field__label';
  label.htmlFor = id;
  label.textContent = options.label;
  root.appendChild(label);

  const controlWrap = document.createElement('div');
  controlWrap.className = 'c-field__control';

  if (options.leadingIcon && !options.multiline) {
    controlWrap.appendChild(icon(options.leadingIcon, { size: 20, className: 'c-field__icon' }));
  }

  const input = options.multiline
    ? document.createElement('textarea')
    : document.createElement('input');
  input.id = id;
  if (options.name) input.name = options.name;
  if (input instanceof HTMLInputElement) {
    input.type = options.type ?? 'text';
  } else if (options.rows) {
    input.rows = options.rows;
  }
  input.className = options.multiline ? 'c-textarea' : 'c-input';
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.value !== undefined) input.value = options.value;
  if (options.disabled) input.disabled = true;
  if (options.required) input.required = true;
  if (options.autocomplete) input.autocomplete = options.autocomplete as AutoFill;

  controlWrap.appendChild(input);
  root.appendChild(controlWrap);

  const hintEl = document.createElement('p');
  hintEl.id = hintId;
  hintEl.className = 'c-field__hint';
  hintEl.textContent = options.helperText ?? '';
  if (!options.helperText) hintEl.hidden = true;
  root.appendChild(hintEl);

  const errorEl = document.createElement('p');
  errorEl.id = errId;
  errorEl.className = 'c-field__error';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;
  root.appendChild(errorEl);

  const setError = (message: string | null): void => {
    const hasErr = Boolean(message && message.trim());
    root.classList.toggle('c-field--error', hasErr);
    input.setAttribute('aria-invalid', String(hasErr));
    if (hasErr) {
      errorEl.textContent = message!;
      errorEl.hidden = false;
      input.setAttribute('aria-describedby', errId);
    } else {
      errorEl.textContent = '';
      errorEl.hidden = true;
      if (options.helperText) input.setAttribute('aria-describedby', hintId);
      else input.removeAttribute('aria-describedby');
    }
  };

  setError(options.errorText ?? null);

  if (options.onInput) {
    input.addEventListener('input', () => options.onInput!(input.value));
  }

  return {
    element: root,
    input,
    getValue: () => input.value,
    setValue: (value: string) => {
      input.value = value;
    },
    setError,
  };
}

// ── Switch ───────────────────────────────────────────────────────────────────

export interface SwitchOptions {
  ariaLabel: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export interface SwitchController {
  element: HTMLButtonElement;
  isChecked: () => boolean;
  setChecked: (checked: boolean) => void;
}

export function createSwitch(options: SwitchOptions): SwitchController {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'c-switch';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-label', options.ariaLabel);
  btn.setAttribute('aria-checked', String(Boolean(options.checked)));
  if (options.disabled) btn.disabled = true;

  const track = document.createElement('span');
  track.className = 'c-switch__track';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('span');
  thumb.className = 'c-switch__thumb';
  track.appendChild(thumb);
  btn.appendChild(track);

  let checked = Boolean(options.checked);

  const setChecked = (next: boolean): void => {
    checked = next;
    btn.setAttribute('aria-checked', String(checked));
  };

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    setChecked(!checked);
    options.onChange?.(checked);
  });

  return {
    element: btn,
    isChecked: () => checked,
    setChecked,
  };
}

// ── Segmented Control ────────────────────────────────────────────────────────

export interface SegmentItem<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedOptions<T extends string = string> {
  ariaLabel: string;
  items: readonly SegmentItem<T>[];
  value: T;
  fullWidth?: boolean;
  onChange?: (value: T) => void;
}

export interface SegmentedController<T extends string = string> {
  element: HTMLElement;
  setValue: (value: T) => void;
}

export function createSegmentedControl<T extends string = string>(
  options: SegmentedOptions<T>,
): SegmentedController<T> {
  const group = document.createElement('div');
  group.className = `c-segmented${options.fullWidth ? ' c-segmented--full' : ''}`;
  group.setAttribute('role', 'tablist');
  group.setAttribute('aria-label', options.ariaLabel);

  const buttons = new Map<T, HTMLButtonElement>();

  const setValue = (next: T): void => {
    buttons.forEach((btn, val) => {
      const active = val === next;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
  };

  for (const item of options.items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'c-seg-btn';
    btn.setAttribute('role', 'tab');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      setValue(item.value);
      options.onChange?.(item.value);
    });
    buttons.set(item.value, btn);
    group.appendChild(btn);
  }

  setValue(options.value);

  return { element: group, setValue };
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function createTabs<T extends string = string>(options: SegmentedOptions<T>): SegmentedController<T> {
  const bar = document.createElement('div');
  bar.className = 'c-tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', options.ariaLabel);

  const buttons = new Map<T, HTMLButtonElement>();

  const setValue = (next: T): void => {
    buttons.forEach((btn, val) => {
      const active = val === next;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
  };

  for (const item of options.items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'c-tab-btn';
    btn.setAttribute('role', 'tab');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      setValue(item.value);
      options.onChange?.(item.value);
    });
    buttons.set(item.value, btn);
    bar.appendChild(btn);
  }

  setValue(options.value);
  return { element: bar, setValue };
}
