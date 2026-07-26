"use client";

import { useState } from "react";

export function SignInPanel({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <h1 className="font-display text-6xl sm:text-7xl text-craie tracking-tight leading-none">
        Coupe
      </h1>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="bg-verre text-cave font-medium rounded-sm px-6 py-3 hover:brightness-110 transition-colors"
        >
          Log in
        </button>
      ) : (
        <form action={action} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="bg-rack border border-craie/15 rounded-sm px-4 py-3 text-craie placeholder:text-lees focus:outline-none focus:ring-1 focus:ring-verre text-center"
          />
          <button
            type="submit"
            className="bg-verre text-cave font-medium rounded-sm px-4 py-3 hover:brightness-110 transition-colors"
          >
            Send magic link
          </button>
          <p className="text-lees text-xs mt-2">
            Invite-only. If your email isn&apos;t on the list, this won&apos;t
            work — ask whoever runs the book.
          </p>
        </form>
      )}
    </div>
  );
}
