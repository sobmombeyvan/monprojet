"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    // Hook for error monitoring (Sentry, etc.) — see README › Error monitoring
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="size-10 text-danger" />
      <h1 className="mt-4 text-2xl font-semibold">{t("errorTitle")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("errorText")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">#{error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
