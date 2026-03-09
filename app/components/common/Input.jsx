export default function Input({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  placeholder,
  required = false,
  className = '',
  error,
  icon,
  rightElement,
  ...props 
}) {
  const hasLeftIcon = Boolean(icon);
  const hasRightElement = Boolean(rightElement);
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-aa-text-dark mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {hasLeftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm text-aa-text-dark outline-none placeholder:text-gray-400 focus:border-aa-orange sm:py-3 sm:text-base ${
            error ? 'border-red-500' : 'border-gray-200'
          } ${hasLeftIcon ? 'pl-10' : ''} ${hasRightElement ? 'pr-12' : ''}`}
          data-testid="input-field"
          {...props}
        />
        {hasRightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </span>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
