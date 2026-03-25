export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-aa-orange',
    blue: 'bg-blue-100 text-aa-dark-blue',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <span 
      className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-center text-xs font-semibold leading-snug whitespace-normal break-words ${variants[variant]} ${className}`}
      data-testid="badge"
    >
      {children}
    </span>
  );
}
