/** Dunkles Platzhalter-Gerüst, solange ein Chat lädt – die Elemente stehen schon, nur noch ohne Inhalt. */
const Bar = ({ w, h = "h-3" }: { w: string; h?: string }) => <div className={`${h} ${w} rounded-full bg-white/[0.06] dark:bg-white/[0.06] animate-pulse`} />;

export function ChatSkeleton() {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-10" aria-busy="true" aria-label="Chat lädt">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-6">
          <div className="flex justify-end">
            <div className="rounded-3xl bg-white/[0.05] px-5 py-4 w-[min(70%,420px)] space-y-2"><Bar w="w-full" /><Bar w="w-2/3" /></div>
          </div>
          <div className="flex gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-white/[0.07] animate-pulse" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Bar w="w-11/12" /><Bar w="w-full" /><Bar w="w-4/5" />{i === 1 && <div className="h-28 w-full rounded-2xl bg-white/[0.04] animate-pulse mt-3" />}<Bar w="w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
