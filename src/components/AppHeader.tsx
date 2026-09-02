"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

type NavItem = { href: string; label: string };

export function AppHeader({
  navItems,
  userEmail,
  signOutAction,
}: {
  navItems: NavItem[];
  userEmail: string | undefined;
  signOutAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="print:hidden border-b border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/pmibd-logo.svg"
            alt="PMI Bangladesh Chapter"
            width={111}
            height={43}
            className="h-8 w-auto"
            priority
          />
          <span className="hidden text-xs tracking-wide text-zinc-400 uppercase sm:inline">
            Expense Management
          </span>
        </Link>

        <nav className="hidden items-center gap-4 border-l border-zinc-200 pl-6 text-sm text-zinc-600 sm:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-zinc-950">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 text-sm sm:flex">
          <span className="text-zinc-600">{userEmail}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 sm:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-200 px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1 text-sm text-zinc-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 hover:bg-zinc-100 hover:text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3 text-sm">
            <span className="text-zinc-600">{userEmail}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-left hover:bg-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
