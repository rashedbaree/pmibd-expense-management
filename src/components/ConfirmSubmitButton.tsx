"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export function ConfirmSubmitButton({
  confirmTitle = "Please Confirm",
  confirmMessage,
  destructive = false,
  children,
  ...rest
}: {
  confirmTitle?: string;
  confirmMessage: string;
  destructive?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        {...rest}
        ref={buttonRef}
        type="submit"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          destructive={destructive}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            // A fresh click on the modal's button, not nested inside the
            // form's own submit handling - requestSubmit(this button)
            // resubmits as if it were clicked, name/value included.
            buttonRef.current?.form?.requestSubmit(buttonRef.current);
          }}
        />
      )}
    </>
  );
}
