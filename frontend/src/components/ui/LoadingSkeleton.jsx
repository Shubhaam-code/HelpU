export function LoadingSkeleton({ count = 3, type = 'card' }) {
  if (type === 'card') {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-28 mb-2" />
                <div className="skeleton h-3 w-20" />
              </div>
            </div>
            <div className="skeleton h-3 w-full mb-2" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  if (type === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return <div className="skeleton h-48 w-full rounded-2xl" />;
}

export default LoadingSkeleton;

