export default function OuraConnectingLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [CONNECTING · OURA]
        </div>
        <h1 className="text-2xl font-semibold">Pulling your recovery…</h1>
        <p className="text-sm text-muted leading-relaxed">
          Importing your last 30 days of sleep and readiness scores.
          This usually takes a few seconds.
        </p>
        <div className="flex justify-center pt-2">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
