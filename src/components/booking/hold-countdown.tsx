"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("booking");
  const router = useRouter();
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);
  const s = Math.max(0, Math.floor(left / 1000));
  const time = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-warning" aria-live="off">
      <Timer className="size-4" /> {t("timeLeft", { time })}
    </p>
  );
}
