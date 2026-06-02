export default function Loading() {
  return (
    <div className="w-full p-8 animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100"></div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex p-4 border-b border-gray-50 items-center gap-4">
            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
