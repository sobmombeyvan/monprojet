"use client";
import { useState } from "react";
import { Check, Shuffle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { avatarSrc, bitmojiChoices, isBitmoji } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Lets a consultant (or an admin) pick a bitmoji avatar or upload a real photo.
 * The photo is stored in the uploader's own folder of the public "avatars" bucket
 * (storage policy: users may only write in <their user id>/…).
 */
export function PhotoPicker({
  value,
  onChange,
  name,
  inputName,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  name: string;
  /** When set, also renders a hidden form field (for plain <form> submissions). */
  inputName?: string;
}) {
  const [page, setPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = bitmojiChoices(name, page);

  async function upload(file: File) {
    setError(null);
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Photo : PNG, JPG ou WebP, 2 Mo maximum.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Session expirée, reconnectez-vous.");
      const path = `${data.user.id}/${crypto.randomUUID()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
      const { error: e } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
      if (e) throw e;
      onChange(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(`Photo : ${e instanceof Error ? e.message : "envoi impossible"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      {inputName && <input type="hidden" name={inputName} value={value ?? ""} />}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={value} name={name} size={80} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <label className="cursor-pointer">
              <Upload /> {uploading ? "Envoi…" : "Importer une photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            </label>
          </Button>
          {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Avatar par défaut</Button>}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-navy">Ou choisissez un bitmoji</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}><Shuffle /> Autres</Button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {choices.map((c) => {
            const on = value === c;
            return (
              <button key={c} type="button" onClick={() => onChange(c)} aria-pressed={on} aria-label="Choisir ce bitmoji"
                className={cn("relative aspect-square min-w-0 overflow-hidden rounded-full ring-2 transition", on ? "ring-teal" : "ring-transparent hover:ring-line")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc(c, name)} alt="" width={64} height={64} className="block size-full" />
                {on && <span className="absolute inset-0 grid place-items-center bg-teal/30"><Check className="size-5 text-white" /></span>}
              </button>
            );
          })}
        </div>
        {!value && <p className="mt-2 text-xs text-muted">Sans choix, un bitmoji est créé automatiquement à partir de votre nom.</p>}
        {value && !isBitmoji(value) && <p className="mt-2 text-xs text-muted">Photo importée utilisée.</p>}
      </div>
    </div>
  );
}
