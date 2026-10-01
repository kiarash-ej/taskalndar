// What a form's server action returns to useActionState.
export interface FormState {
  error?: string;
  // shown on success, e.g. "check your email"
  message?: string;
  // the submitted values, so a failed submit keeps what the user typed
  values?: Record<string, string>;
}

export const initialFormState: FormState = {};

export function formValues(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

export const GENERIC_ERROR = "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.";
