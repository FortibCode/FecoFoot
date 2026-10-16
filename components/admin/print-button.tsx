"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="h-10">
      {label}
    </Button>
  );
}
