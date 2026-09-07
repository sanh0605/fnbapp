export type AlertOptions = {
  title?: string;
  message: string;
  okText?: string;       // default "Đã hiểu"
  variant?: "info" | "warning" | "danger";  // controls icon + button color
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  okText?: string;       // default "Xác nhận"
  cancelText?: string;   // default "Huỷ"
  variant?: "info" | "warning" | "danger";  // controls icon + ok button color
};

type DialogType = "alert" | "confirm";

type DialogState = {
  id: string;
  type: DialogType;
  options: AlertOptions | ConfirmOptions;
  resolve: (value: any) => void;
};

let queue: DialogState[] = [];
const listeners: Set<() => void> = new Set();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => queue[0] || null;

const emit = () => {
  listeners.forEach(listener => listener());
};

const push = (type: DialogType, options: AlertOptions | ConfirmOptions) => {
  return new Promise<any>((resolve) => {
    const state: DialogState = {
      id: Math.random().toString(36).slice(2),
      type,
      options,
      resolve,
    };
    queue = [...queue, state];
    emit();
  });
};

export function alert(options: AlertOptions): Promise<void> {
  return push("alert", options);
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return push("confirm", { variant: "warning", ...options });
}

export function dismiss(value?: any) {
  if (queue.length === 0) return;
  const current = queue[0];
  queue = queue.slice(1);
  emit();
  current.resolve(value);
}

export const dialogStore = { subscribe, getSnapshot };
