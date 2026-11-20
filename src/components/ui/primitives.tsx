import * as React from "react";
import { AlertCircle, CheckCircle2, Info, Inbox, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-line px-5 py-4 sm:px-6", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-cloud text-navy ring-line",
  teal: "bg-teal-50 text-teal-600 ring-teal/25",
  navy: "bg-navy text-white ring-navy",
  success: "bg-green-50 text-success ring-green-200",
  warning: "bg-amber-50 text-warning ring-amber-200",
  danger: "bg-orange-50 text-danger ring-orange-200",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3.5", badgeTones[tone], className)}
      {...props}
    />
  );
}

const alertTones = {
  info: { cls: "border-navy-50 bg-navy-50/60 text-navy", Icon: Info },
  success: { cls: "border-green-200 bg-green-50 text-success", Icon: CheckCircle2 },
  warning: { cls: "border-amber-200 bg-amber-50 text-warning", Icon: TriangleAlert },
  error: { cls: "border-orange-200 bg-orange-50 text-danger", Icon: AlertCircle },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-cloud", className)} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-cloud/50 px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-white text-teal shadow-[var(--shadow-card)]">
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ src, name, size = 56 }: { src?: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      aria-label={name}
      className="grid shrink-0 place-items-center rounded-full bg-navy font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
