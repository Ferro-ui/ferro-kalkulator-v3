export const Card = ({ children, style, className = '' }) => (
  <div className={`glass ${className}`} style={style}>{children}</div>
)

export const Tag = ({ color, children }) => (
  <span className="tag" style={{ background: color + '18', color, border: `1px solid ${color}35` }}>{children}</span>
)

export const Spinner = ({ size = 44 }) => (
  <div className="spinner-ring" style={{ width: size, height: size }} />
)
