"use client";

/**
 * Submit button that asks for confirmation first. Lets Server Components keep plain
 * <form action={serverAction}> while still confirming destructive actions in the browser.
 */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
