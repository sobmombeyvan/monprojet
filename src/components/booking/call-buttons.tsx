import { Phone, PhoneCall, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

type Booking = { reference?: unknown; status?: unknown; method?: unknown; ends_at?: unknown };

/** "Video call" / "Audio call" buttons for a confirmed booking (+ a phone link when one is given). */
export async function CallButtons({ booking, phone, size = "sm" }: { booking: Booking; phone?: string | null; size?: "sm" | "md" }) {
  if (booking.status !== "confirmed" || booking.method === "in_person") return null;
  if (booking.ends_at && Date.now() > new Date(String(booking.ends_at)).getTime() + 3 * 3600_000) return null;
  const t = await getTranslations("call");
  const locale = await getLocale();
  const base = `${locale === "en" ? "/en" : ""}/booking/${encodeURIComponent(String(booking.reference))}/call`;
  const tel = phone ? phone.replace(/[^\d+]/g, "") : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size={size}>
        <a href={`${base}?mode=video`} target="_blank" rel="noopener">
          <Video /> {t("video")}
        </a>
      </Button>
      <Button asChild size={size} variant="outline">
        <a href={`${base}?mode=audio`} target="_blank" rel="noopener">
          <PhoneCall /> {t("audio")}
        </a>
      </Button>
      {tel && (
        <Button asChild size={size} variant="ghost">
          <a href={`tel:${tel}`}>
            <Phone /> {t("phone")}
          </a>
        </Button>
      )}
    </div>
  );
}
