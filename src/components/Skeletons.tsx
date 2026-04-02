export function PostSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4 mb-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-muted rounded-t-lg" />
      <div className="p-4 -mt-10">
        <div className="w-20 h-20 rounded-full bg-muted border-4 border-card" />
        <div className="mt-3 space-y-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
