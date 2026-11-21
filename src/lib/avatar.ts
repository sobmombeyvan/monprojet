import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

/**
 * Bitmoji-style avatars (DiceBear "Avataaars" by Pablo Stanley — free for personal and commercial use).
 * Generated locally, no external service. A consultant's `photo_url` is either:
 *  - an uploaded photo URL (https://…), or
 *  - "avatar:<seed>" — a chosen bitmoji, or
 *  - null — a default bitmoji derived from their name.
 */
export const AVATAR_PREFIX = "avatar:";
const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c7f0db"];

export const isBitmoji = (v?: string | null): v is string => !!v && v.startsWith(AVATAR_PREFIX);

export function bitmojiUri(seed: string) {
  return createAvatar(avataaars, { seed, backgroundColor: BACKGROUNDS, backgroundType: ["solid"] }).toDataUri();
}

/** Image source for any avatar value (photo URL, chosen bitmoji or default from the name). */
export function avatarSrc(photo: string | null | undefined, name: string) {
  if (photo && !isBitmoji(photo)) return photo;
  return bitmojiUri(isBitmoji(photo) ? photo.slice(AVATAR_PREFIX.length) : name || "expert");
}

/** A set of bitmoji choices for a person (page = "shuffle" index). */
export function bitmojiChoices(base: string, page = 0, count = 8) {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "expert";
  return Array.from({ length: count }, (_, i) => `${AVATAR_PREFIX}${clean}-${page * count + i + 1}`);
}

/** Only accept our own bitmoji values or photos stored in this project's Supabase "avatars" bucket. */
export function isAllowedPhotoUrl(v: string) {
  if (/^avatar:[a-z0-9-]{1,80}$/.test(v)) return true;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!base && v.startsWith(`${base}/storage/v1/object/public/avatars/`);
}
