export function EmptyState({ icon = '🌿', title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <div className="font-bold text-navy text-lg mb-2">{title}</div>
      {subtitle && <div className="text-text-secondary text-sm mb-6 max-w-xs leading-relaxed">{subtitle}</div>}
      {action}
    </div>
  );
}

export default EmptyState;
