export default function Loader({ size = 'md', text = '' }) {
  const sizes = {
    sm: { scene: '72px', label: 'text-xs' },
    md: { scene: '104px', label: 'text-sm' },
    lg: { scene: '144px', label: 'text-base' },
    xl: { scene: '176px', label: 'text-base' },
  };

  const selected = sizes[size] || sizes.md;

  return (
    <div
      className="aa-loader"
      style={{ '--aa-loader-size': selected.scene }}
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading'}
      data-testid="loader"
    >
      <div className="aa-loader__scene" aria-hidden="true">
        <span className="aa-loader__halo aa-loader__halo--warm"></span>
        <span className="aa-loader__halo aa-loader__halo--cool"></span>
        <span className="aa-loader__panel"></span>
        <span className="aa-loader__ring aa-loader__ring--outer"></span>
        <span className="aa-loader__ring aa-loader__ring--inner"></span>
        <span className="aa-loader__sweep"></span>
        <span className="aa-loader__brand-shell">
          <span className="aa-loader__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cropped_image-2026-03-09T09-25-38.png"
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              className="aa-loader__brand-image"
              draggable={false}
            />
          </span>
        </span>
      </div>
      <div className="aa-loader__meta">
        <span className="aa-loader__brand-label">AlgoChat</span>
        {text ? (
          <p className={`aa-loader__text ${selected.label}`}>{text}</p>
        ) : (
          <span className="sr-only">Loading</span>
        )}
        <span className="aa-loader__progress" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    </div>
  );
}
