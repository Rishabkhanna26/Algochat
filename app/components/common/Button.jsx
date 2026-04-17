export default function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  type = 'button',
  disabled = false,
  className = '',
  icon 
}) {
  const baseClass = 'max-w-full min-w-0 px-3.5 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-[0.95rem] rounded-xl font-semibold inline-flex items-center justify-center gap-2 text-center leading-snug whitespace-normal break-words transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-aa-orange text-white hover:-translate-y-0.5 hover:bg-[#e56000] hover:shadow-lg',
    secondary: 'bg-white text-aa-dark-blue border-2 border-aa-dark-blue hover:-translate-y-0.5 hover:bg-aa-dark-blue hover:text-white',
    outline: 'bg-transparent text-aa-orange border-2 border-aa-orange hover:-translate-y-0.5 hover:bg-aa-orange hover:text-white',
    ghost: 'bg-transparent text-aa-gray hover:bg-gray-100',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variants[variant]} ${className}`}
      data-testid="button"
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}
