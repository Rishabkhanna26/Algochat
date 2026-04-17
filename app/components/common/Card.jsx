export default function Card({
  children,
  className = '',
  onClick,
  hover = false,
  unstyled = false,
}) {
  const baseClass = unstyled
    ? ''
    : 'aa-surface-card w-full min-w-0 break-words rounded-2xl p-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-transform duration-200 sm:p-5 lg:p-6';
  return (
    <div
      className={`${baseClass} ${hover ? 'hover:shadow-md cursor-pointer' : ''} ${className}`.trim()}
      onClick={onClick}
      data-testid="card"
    >
      {children}
    </div>
  );
}
