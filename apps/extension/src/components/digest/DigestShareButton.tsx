"use client";

import { useCallback, useState } from "react";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback: execCommand
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Clipboard copy failed");
}

export function DigestShareButton(props: { text: string; disabled?: boolean }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const onCopy = useCallback(async () => {
    setStatus("idle");
    try {
      await copyToClipboard(props.text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [props.text]);

  const label = status === "copied" ? "コピーしました" : status === "error" ? "コピー失敗" : "共有用要約をコピー";

  return (
    <button
      className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      onClick={onCopy}
      disabled={props.disabled}
      type="button"
    >
      {label}
    </button>
  );
}
