import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/primitives";
import { ConfirmationPoller } from "@/components/booking/confirmation-poller";
import { requireUser } from "@/lib/auth/session";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const { ref } = await searchParams;
  if (!ref || !/^GLB-\d{6}-[0-9A-F]{6}$/.test(ref)) notFound();
  return (
    <div className="bg-cloud">
      <div className="container-page flex max-w-2xl justify-center py-16">
        <Card className="w-full p-8 sm:p-12">
          {/* The displayed status comes from the database (set by the verified webhook), never from URL params. */}
          <ConfirmationPoller reference={ref} />
        </Card>
      </div>
    </div>
  );
}
