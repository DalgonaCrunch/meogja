// 전역 다이얼로그 컨트롤러
// DialogProvider가 등록한 setter를 통해 비-React 컨텍스트에서도 호출 가능

export type DialogState =
  | { type: "alert"; icon?: string; title?: string; message: string; resolve: () => void }
  | { type: "confirm"; icon?: string; title?: string; message: string; danger?: boolean; confirmLabel?: string; resolve: (v: boolean) => void }
  | { type: "prompt"; title?: string; message: string; placeholder?: string; defaultValue?: string; inputType?: string; resolve: (v: string | null) => void };

export type ToastState = { id: number; message: string; icon?: string };

let _setDialog: ((s: DialogState | null) => void) | null = null;
let _addToast: ((t: ToastState) => void) | null = null;
let _toastId = 0;

export function _registerDialog(fn: typeof _setDialog) { _setDialog = fn; }
export function _registerToast(fn: typeof _addToast) { _addToast = fn; }

export function toast(message: string, icon = "✓") {
  _addToast?.({ id: ++_toastId, message, icon });
}

export function showAlert(message: string, opts?: { title?: string; icon?: string }): Promise<void> {
  return new Promise((resolve) => {
    _setDialog?.({ type: "alert", message, title: opts?.title, icon: opts?.icon, resolve });
  });
}

export function showConfirm(message: string, opts?: { title?: string; icon?: string; danger?: boolean; confirmLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    _setDialog?.({ type: "confirm", message, title: opts?.title, icon: opts?.icon, danger: opts?.danger, confirmLabel: opts?.confirmLabel, resolve });
  });
}

export function showPrompt(message: string, opts?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    _setDialog?.({ type: "prompt", message, title: opts?.title, placeholder: opts?.placeholder, defaultValue: opts?.defaultValue, inputType: opts?.inputType, resolve });
  });
}
