export default function POSLoading() {
  return (
    <div className="fixed inset-0 flex bg-surface-secondary font-sans overflow-hidden animate-pulse">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-surface-card h-14 border-b border-border flex items-center justify-between px-4 shrink-0 shadow-sm">
          <div className="h-6 bg-border rounded w-32"></div>
          <div className="h-6 bg-border rounded w-24"></div>
        </header>
        <div className="bg-surface-card px-4 py-2 flex items-center gap-2 border-b border-border">
           <div className="h-10 bg-border rounded w-full"></div>
        </div>
        <div className="flex-1 overflow-auto md:p-4 bg-page/50">
          <div className="flex flex-col md:hidden bg-surface-card">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="w-full h-[64px] px-3.5 py-2 flex items-center justify-between gap-3 border-b border-border"
              >
                <div className="h-5 bg-border rounded w-36"></div>
                <div className="h-5 bg-border rounded w-16"></div>
              </div>
            ))}
          </div>

          <div className="hidden md:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
             {[1,2,3,4,5,6,7,8,9,10].map(i => (
               <div key={i} className="h-40 bg-surface-card rounded-xl border border-border"></div>
             ))}
          </div>
        </div>
      </div>
      <div className="hidden md:flex md:w-96 bg-surface-card flex-col border-l border-border shadow-xl shrink-0 z-10">
         <div className="h-14 border-b border-border bg-page/50 px-4 flex items-center">
            <div className="h-6 bg-border rounded w-1/2"></div>
         </div>
         <div className="flex-1 p-4">
            <div className="h-24 bg-surface-secondary rounded-xl mb-4"></div>
            <div className="h-24 bg-surface-secondary rounded-xl"></div>
         </div>
         <div className="p-4 border-t border-border bg-page/80">
            <div className="h-14 bg-border rounded-2xl w-full"></div>
         </div>
      </div>
    </div>
  );
}
