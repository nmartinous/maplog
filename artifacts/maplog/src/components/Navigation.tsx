import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Library, Layers, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',           icon: Home,     label: 'Player'     },
  { href: '/collection', icon: Library,  label: 'Collection' },
  { href: '/playlists',  icon: Layers,   label: 'By Rarity'  },
  { href: '/profile',    icon: User,     label: 'Profile'    },
  { href: '/settings',   icon: Settings, label: 'Settings'   },
];

export function Navigation() {
  const [location] = useLocation();

  const isActive = (href: string) =>
    href === '/' ? location === '/' : location.startsWith(href);

  return (
    <>
      {/* ── Mobile bottom tab bar ── */}
      {/*
        The nav extends to the very bottom of the screen (behind the home indicator
        on iOS) via padding-bottom: env(safe-area-inset-bottom). The tap-target row
        stays at a fixed h-16 above it, so taps never land inside the iOS gesture zone.
      */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/8 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="h-16 flex items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-[3px] py-2 px-3 min-w-0 flex-1"
              >
                <Icon
                  className={cn(
                    'h-[22px] w-[22px] transition-all duration-200',
                    active ? 'text-white' : 'text-white/30',
                  )}
                  strokeWidth={active ? 2.2 : 1.6}
                />
                <span className={cn(
                  'text-[9px] font-semibold leading-none tracking-wide transition-colors truncate',
                  active ? 'text-white' : 'text-white/30',
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden sm:flex fixed top-0 bottom-0 left-0 w-56 bg-card border-r border-border z-50 flex-col py-8 px-4">
        {/* Logo */}
        <div className="mb-8 px-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF3C00]/20 flex items-center justify-center shrink-0">
            <Home className="h-4 w-4 text-[#FF3C00]" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Maplog</span>
        </div>

        <div className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer',
                  active
                    ? 'bg-white/8 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}>
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="text-sm">{label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
