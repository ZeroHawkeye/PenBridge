import { Skeleton } from "@/components/ui/skeleton";

export function ArticleEditSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16 hidden md:block" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md hidden md:block" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: "768px" }}>
          <Skeleton className="h-9 w-3/5 mb-3" />
          
          <div className="flex items-center justify-between mt-3 mb-4">
            <div className="flex-1 h-px bg-border/40" />
            <Skeleton className="h-7 w-24 ml-3 rounded-md" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[88%]" />
            </div>
            <div className="h-2" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[75%]" />
            </div>
            <div className="h-2" />
            <div className="pl-4 border-l-2 border-muted space-y-2">
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
