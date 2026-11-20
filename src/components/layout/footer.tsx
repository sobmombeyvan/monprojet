import { Mail, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "./logo";

export async function Footer() {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "contact").maybeSingle();
  const contact = (data?.value ?? {}) as { email?: string; phone?: string; city?: string };

  const columns = [
    {
      title: t("footer.platform"),
      links: [
        { href: "/find-expert", label: t("nav.findExpert") },
        { href: "/services", label: t("nav.services") },
        { href: "/booking", label: t("common.book") },
        { href: "/register?type=consultant", label: t("footer.becomeConsultant") },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { href: "/countries", label: t("nav.countries") },
        { href: "/knowledge", label: t("nav.knowledge") },
        { href: "/faq", label: t("footer.faq") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: "/about", label: t("nav.about") },
        { href: "/contact", label: t("footer.contact") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/terms", label: t("footer.terms") },
      ],
    },
  ];

  return (
    <footer className="bg-navy text-white">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.2fr]">
        <div>
          <Logo inverted />
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/70">{t("footer.about")}</p>
          <p className="mt-4 text-sm font-medium text-teal">{t("brand.tagline")}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/70 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="text-sm font-semibold text-white">{t("footer.contact")}</h3>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {contact.email && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-teal" />
                <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>
              </li>
            )}
            {contact.phone && (
              <li className="flex items-center gap-2"><Phone className="size-4 text-teal" />{contact.phone}</li>
            )}
            {contact.city && (
              <li className="flex items-center gap-2"><MapPin className="size-4 text-teal" />{contact.city}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl leading-5">{t("footer.disclaimer")}</p>
          <p className="shrink-0">{t("footer.rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
