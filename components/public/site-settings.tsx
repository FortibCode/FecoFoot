"use client";

import { createContext, use, type ReactNode } from "react";

/** Réseaux sociaux officiels, lus en base par la mise en page (paramètres du portail). */
export type Socials = { facebook: string | null; instagram: string | null; x: string | null; youtube: string | null };

const SocialsContext = createContext<Socials>({ facebook: null, instagram: null, x: null, youtube: null });

export function SocialsProvider({ socials, children }: { socials: Socials; children: ReactNode }) {
  return <SocialsContext value={socials}>{children}</SocialsContext>;
}

const ICONS: { key: keyof Socials; name: string; path: string }[] = [
  {
    key: "facebook",
    name: "Facebook",
    path: "M13.5 21v-7.5h2.5l.4-3H13.5V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.8v2.4H8v3h2.5V21h3z",
  },
  {
    key: "instagram",
    name: "Instagram",
    path: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.8-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM20.9 8c-.1-1.4-.4-2.7-1.4-3.6-1-1-2.2-1.3-3.6-1.4H8.1c-1.4.1-2.7.4-3.6 1.4-1 1-1.3 2.2-1.4 3.6v7.9c.1 1.4.4 2.7 1.4 3.6 1 1 2.2 1.3 3.6 1.4h7.8c1.4-.1 2.7-.4 3.6-1.4 1-1 1.3-2.2 1.4-3.6V8zm-1.6 8.5c-.2.5-.6 1-1.1 1.2-.8.3-2.6.2-3.4.2h-5.6c-.8 0-2.7.1-3.4-.2-.5-.2-.9-.6-1.1-1.2-.3-.8-.2-2.6-.2-3.4v-2.3c0-.8-.1-2.7.2-3.4.2-.5.6-1 1.1-1.2.8-.3 2.6-.2 3.4-.2h5.6c.8 0 2.7-.1 3.4.2.5.2.9.6 1.1 1.2.3.8.2 2.6.2 3.4v2.3c0 .8.1 2.7-.2 3.4z",
  },
  {
    key: "x",
    name: "X",
    path: "M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.4l11.3 14.5z",
  },
  {
    key: "youtube",
    name: "YouTube",
    path: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z",
  },
];

/** Liens du pied de page vers les comptes renseignés dans les paramètres (rien si aucun). */
export function FooterSocials() {
  const socials = use(SocialsContext);
  const links = ICONS.filter((i) => socials[i.key]);
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Suivez-nous</p>
      <ul className="flex gap-2.5">
        {links.map((s) => (
          <li key={s.key}>
            <a
              href={socials[s.key]!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`FECOFOOT sur ${s.name}`}
              className="flex size-10 items-center justify-center rounded-md border border-white/20 text-white transition motion-safe:hover:-translate-y-0.5 hover:border-[var(--flag-yellow)] hover:bg-[var(--flag-yellow)] hover:text-brand-ink focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-[1.15rem]" fill="currentColor">
                <path d={s.path} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
