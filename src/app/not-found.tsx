import Link from "next/link";

/**
 * Global 404 handler. Without this Next.js falls back to its default
 * white unstyled page, which looks broken sitting inside our dark
 * shell. Renders inside the app layout so bottom nav + north star
 * bar stay visible for orientation.
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center py-8 space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [404 · NOT FOUND]
        </div>
        <h1 className="text-2xl font-semibold mt-2">
          That page doesn&apos;t exist.
        </h1>
        <p className="text-sm text-muted mt-2 max-w-sm">
          Wrong URL, a stale link, or something we haven&apos;t built yet.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2"
        >
          Home →
        </Link>
        <Link
          href="/trails"
          className="text-sm text-blue-300 hover:underline"
        >
          Trails
        </Link>
      </div>
    </div>
  );
}
