import { Link } from "@/i18n/navigation";

export function SectionHeading({ eyebrow, title, href, linkLabel, center }: { eyebrow?: string; title: string; href?: string; linkLabel?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "flex flex-wrap items-end justify-between gap-6"}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display mt-2 text-3xl sm:text-[2.5rem]">{title}</h2>
      </div>
      {href && linkLabel && <Link href={href} className="link text-sm">{linkLabel}</Link>}
    </div>
  );
}
