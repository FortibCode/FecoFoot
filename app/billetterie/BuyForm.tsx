"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { formatFcfa } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments-rules";
import { useActionForm } from "@/lib/use-action-form";

type Category = { id: number; name: string; gate: string; price: number; left: number };

export function BuyForm({
  action,
  categories,
  maxTickets,
  buyerName,
  defaultMethod,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  categories: Category[];
  maxTickets: number;
  buyerName: string;
  defaultMethod: PaymentMethod | null;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const available = categories.filter((c) => c.left > 0);
  const [categoryId, setCategoryId] = useState(available[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const category = categories.find((c) => c.id === categoryId);
  const max = Math.min(maxTickets, category?.left ?? 0);

  if (available.length === 0) return <p className="font-semibold text-destructive">Toutes les tribunes sont complètes.</p>;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <SelectField label="Tribune" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} — {formatFcfa(c.price)}
          </option>
        ))}
      </SelectField>
      <SelectField label="Nombre de billets" name="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} hint={`Au plus ${maxTickets} billets par Fan ID pour ce match.`}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </SelectField>
      <fieldset className="flex flex-col gap-3 bg-card p-4">
        <legend className="float-left mb-1 w-full text-sm font-semibold">Billets nominatifs</legend>
        <p className="text-sm">
          Billet 1 : <strong>{buyerName}</strong> (vous)
        </p>
        {Array.from({ length: quantity - 1 }, (_, i) => (
          <TextField key={i} label={`Billet ${i + 2} : nom du porteur`} name={`holder_${i + 1}`} required minLength={3} />
        ))}
      </fieldset>
      <SelectField label="Payer avec" name="method" defaultValue={defaultMethod ?? "MTN_MOMO"}>
        {(["MTN_MOMO", "AIRTEL_MONEY"] as const).map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </SelectField>
      <p className="flex items-baseline justify-between bg-brand-ink px-4 py-3 text-white">
        <span aria-hidden className="text-sm text-white/75">Total</span>
        <span className="font-display text-2xl font-bold">
          <span className="sr-only">Total : </span>
          {formatFcfa((category?.price ?? 0) * quantity)}
        </span>
      </p>
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 bg-[var(--flag-green)] text-white hover:bg-brand-ink">
        {pending ? "Réservation…" : "Réserver et payer"}
      </Button>
      <p className="text-xs text-muted-foreground">Les places sont réservées 15 minutes, le temps de valider le paiement sur votre téléphone.</p>
    </form>
  );
}
