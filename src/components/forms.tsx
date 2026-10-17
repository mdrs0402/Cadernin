import { formatPhone, maskCentsInput } from '@cadernin/shared';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './ui';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cx('mt-1.5 text-xs', error ? 'font-medium text-red-600' : 'text-stone-500')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

const inputBase =
  'block h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-[15px] text-ink shadow-sm transition placeholder:text-stone-400 ' +
  'hover:border-stone-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 ' +
  'aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100 disabled:bg-stone-100';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx(inputBase, className)} {...props} />;
});

type MaskedProps<T> = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: T;
  onValueChange: (v: T) => void;
};

/** Campo de dinheiro: guarda centavos inteiros; digitar empurra da direita ("1250" = 12,50). */
export function MoneyInput({ value, onValueChange, className, ...props }: MaskedProps<number>) {
  const { text } = maskCentsInput(String(value));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-semibold text-stone-400">
        R$
      </span>
      <input
        inputMode="numeric"
        autoComplete="off"
        className={cx(inputBase, 'pl-11 text-right font-semibold tabular-nums', className)}
        value={text}
        onChange={(e) => onValueChange(maskCentsInput(e.target.value).cents)}
        {...props}
      />
    </div>
  );
}

export function PhoneInput({ value, onValueChange, className, ...props }: MaskedProps<string>) {
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(11) 98765-4321"
      className={cx(inputBase, 'tabular-nums', className)}
      value={formatPhone(value)}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
      {...props}
    />
  );
}
