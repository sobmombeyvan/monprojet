import { Card, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[300px_1fr]" aria-busy="true">
      <Skeleton className="hidden h-[640px] lg:block" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="space-y-4 p-5">
            <div className="flex gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-12" />
            <Skeleton className="h-20" />
            <Skeleton className="h-10" />
          </Card>
        ))}
      </div>
    </div>
  );
}
