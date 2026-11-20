"use client";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerDocumentAction } from "@/lib/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Uploads directly to a PRIVATE Supabase bucket under `<user_id>/…`.
 * Storage RLS rejects any other folder; type and size are checked here, by the bucket
 * configuration and (for consultant documents) again server-side.
 */
export function FileUploader({ bucket, userId, withKind = false }: { bucket: "client-documents" | "consultant-documents"; userId: string; withKind?: boolean }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("diploma");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onFile(file: File) {
    setError(undefined);
    if (!ALLOWED.includes(file.type) || file.size > MAX) return setError(t("documentsText"));
    setBusy(true);
    const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
    const { error: upErr } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (!upErr && withKind) {
      const r = await registerDocumentAction({ kind, path, fileName: file.name.slice(0, 200), mimeType: file.type, size: file.size });
      if (r.error) setError(r.error);
    }
    if (upErr) setError(upErr.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {withKind && (
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto" aria-label="Type">
            <option value="diploma">Diplôme / Diploma</option>
            <option value="license">Licence / License</option>
            <option value="identity">Identité / ID</option>
            <option value="company_registration">Registre / Registration</option>
            <option value="insurance">Assurance / Insurance</option>
            <option value="other">Autre / Other</option>
          </Select>
        )}
        <input
          ref={input}
          type="file"
          accept={ALLOWED.join(",")}
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button type="button" variant="outline" loading={busy} onClick={() => input.current?.click()}>
          <Upload /> {t("upload")}
        </Button>
      </div>
    </div>
  );
}
