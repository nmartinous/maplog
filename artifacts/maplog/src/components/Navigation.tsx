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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/85 backdrop-blur-xl border-t border-white/8 z-50 flex items-center justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className="flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-0">
              <Icon
                className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-white' : 'text-white/30')}
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
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
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
