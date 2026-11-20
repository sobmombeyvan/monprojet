"use client";
import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={share}>
        {copied ? <Check /> : <Share2 />} {copied ? t("copied") : t("share")}
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a href={`https://wa.me/?text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </Button>
    </div>
  );
}
