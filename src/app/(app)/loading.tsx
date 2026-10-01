export default function Loading() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-2xl bg-surface-2" />
        <div className="h-36 rounded-2xl bg-surface-2" />
      </div>
      <div className="h-64 rounded-2xl bg-surface-2" />
    </div>
  );
}
