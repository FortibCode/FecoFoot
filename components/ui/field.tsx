import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";

type FieldProps = { label: string; name: string; errors?: string[]; hint?: string; className?: string };

function Wrapper({ label, errors, hint, className, children }: Omit<FieldProps, "name"> & { children: ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm font-medium", className)}>
      {label}
      {children}
      {hint && !errors?.length && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      {errors?.map((e) => (
        <span key={e} className="text-xs font-normal text-destructive">
          {e}
        </span>
      ))}
    </label>
  );
}

export function TextField({
  label,
  errors,
  hint,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "name" | "className">) {
  return (
    <Wrapper label={label} errors={errors} hint={hint} className={className}>
      <input {...props} aria-invalid={errors?.length ? true : undefined} className={control} />
    </Wrapper>
  );
}

export function SelectField({
  label,
  errors,
  hint,
  className,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name" | "className">) {
  return (
    <Wrapper label={label} errors={errors} hint={hint} className={className}>
      <select {...props} aria-invalid={errors?.length ? true : undefined} className={control}>
        {children}
      </select>
    </Wrapper>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | undefined }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state?.success)
    return (
      <p role="status" className="rounded-md bg-[color-mix(in_oklch,var(--flag-green)_12%,transparent)] px-3 py-2 text-sm">
        {state.success}
      </p>
    );
  return null;
}
