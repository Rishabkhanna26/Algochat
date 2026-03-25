export default function Card({
  children,
  className = '',
  onClick,
  hover = false,
  unstyled = false,
}) {
  const baseClass = unstyled ? '' : 'w-full min-w-0 break-words rounded-xl bg-white p-4 shadow-sm sm:p-6';
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
