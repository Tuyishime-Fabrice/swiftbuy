function Svg({ size = 20, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Bolt = (p) => <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></Svg>
export const Search = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Svg>
export const Cart = (p) => <Svg {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.1a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21 7H6" /></Svg>
export const Heart = (p) => <Svg {...p}><path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z" /></Svg>
export const HeartFilled = (p) => <Svg {...p} fill="currentColor" stroke="none"><path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z" /></Svg>
export const Bell = (p) => <Svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14 18 8" /><path d="M13.7 19a2 2 0 0 1-3.4 0" /></Svg>
export const Menu = (p) => <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>
export const Close = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
export const User = (p) => <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
export const Package = (p) => <Svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></Svg>
export const Store = (p) => <Svg {...p}><path d="M3 9h18l-1-5H4L3 9Z" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></Svg>
export const Chat = (p) => <Svg {...p}><path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></Svg>
export const Chart = (p) => <Svg {...p}><path d="M18 20V10M12 20V4M6 20v-6" /></Svg>
export const Shield = (p) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>
export const Truck = (p) => <Svg {...p}><path d="M2 6h11v10H2z" /><path d="M13 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></Svg>
export const Check = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>
export const Alert = (p) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5v5M12 16h.01" /></Svg>
export const Info = (p) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5M12 8h.01" /></Svg>
export const Sun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2M20 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></Svg>
export const Moon = (p) => <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>
export const LogOut = (p) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></Svg>
export const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const Minus = (p) => <Svg {...p}><path d="M5 12h14" /></Svg>
export const Trash = (p) => <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" /><path d="M10 11v6M14 11v6" /></Svg>
export const Edit = (p) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
export const Star = ({ filled, size = 16, ...p }) => (
  <Svg size={size} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2L12 17l-5.4 3 1-6.2L3.2 9.5l6.1-.9Z" />
  </Svg>
)
export const ArrowLeft = (p) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>
export const ArrowRight = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const Send = (p) => <Svg {...p}><path d="M21 3 3 10.5l7 3 3 7L21 3Z" /></Svg>
export const Filter = (p) => <Svg {...p}><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></Svg>
export const Settings = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 8.2l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></Svg>
export const Users = (p) => <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></Svg>
export const Receipt = (p) => <Svg {...p}><path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3Z" /><path d="M9 8h6M9 12h6" /></Svg>
export const Scale = (p) => <Svg {...p}><path d="M12 3v18M7 21h10" /><path d="m5 7 3 6H2ZM19 7l3 6h-6Z" /><path d="M5 7h14" /></Svg>
export const Clock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const Image = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 16-5-5-9 9" /></Svg>
