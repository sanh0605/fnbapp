export default function POSLoading() {
  return (
    <div className="fixed inset-0 flex bg-gray-100 font-sans overflow-hidden animate-pulse">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white h-14 border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-sm">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
          <div className="h-6 bg-gray-200 rounded w-24"></div>
        </header>
        <div className="bg-white px-4 py-2 flex items-center gap-2 border-b border-gray-200">
           <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
             {[1,2,3,4,5,6,7,8,9,10].map(i => (
               <div key={i} className="h-40 bg-white rounded-xl border border-gray-200"></div>
             ))}
          </div>
        </div>
      </div>
      <div className="w-96 bg-white flex flex-col border-l border-gray-200 shadow-xl shrink-0 z-10">
         <div className="h-14 border-b border-gray-200 bg-gray-50/50 px-4 flex items-center">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
         </div>
         <div className="flex-1 p-4">
            <div className="h-24 bg-gray-100 rounded-xl mb-4"></div>
            <div className="h-24 bg-gray-100 rounded-xl"></div>
         </div>
         <div className="p-4 border-t border-gray-200 bg-gray-50/80">
            <div className="h-14 bg-gray-200 rounded-2xl w-full"></div>
         </div>
      </div>
    </div>
  );
}
