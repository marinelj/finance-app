import { useState } from 'react';

import { haptics } from '@/lib/haptics';

export type FormErrors<V> = Partial<Record<keyof V, string>>;

/**
 * Minimal form state: values, a setter per field, and errors from a (zod-backed) `validate`
 * function. Errors stay hidden until the first submit attempt, then update as the user types.
 */
export function useForm<V extends object>(
  initial: V | (() => V),
  validate: (values: V) => FormErrors<V>
) {
  const [values, setValues] = useState<V>(initial);
  const [submitted, setSubmitted] = useState(false);
  const allErrors = validate(values);
  const isValid = Object.keys(allErrors).length === 0;

  const set = <K extends keyof V>(key: K, value: V[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  /** Runs `onValid` with the values when they validate; otherwise reveals the errors. */
  const submit = (onValid: (values: V) => void): boolean => {
    setSubmitted(true);
    if (!isValid) {
      haptics.error();
      return false;
    }
    onValid(values);
    return true;
  };

  return {
    values,
    set,
    setValues,
    errors: submitted ? allErrors : ({} as FormErrors<V>),
    isValid,
    submitted,
    submit,
  };
}
