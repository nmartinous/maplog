import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Library, Layers, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/',           icon: Home,     label: 'Player'     },
  { href: '/collection', icon: Library,  label: 'Collection' },
  { href: '/playlists',  icon: Layers,   label: 'Rarities'  },
  { href: '/profile',    icon: User,     label: 'Profile'    },
  { href: '/settings',   icon: Settings, label: 'Settings'   },
];

function useActiveNav() {
  const [location] = useLocation();
  return (href: string) => href === '/' ? location === '/' : location.startsWith(href);
}

export function DesktopSidebar() {
  const isActive = useActiveNav();

  return (
    <nav className="hidden sm:flex flex-col w-64 shrink-0 bg-card/40 border-r border-white/5 py-8 px-5 h-full overflow-y-auto backdrop-blur-3xl relative z-40">
      <div className="mb-10 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <Home className="h-5 w-5 text-white" />
        </div>
        <span className="text-2xl font-display font-black tracking-tight text-white">Maplog</span>
      </div>

      <div className="space-y-1.5 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href}>
              <div className={cn(
                'group relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer overflow-hidden',
                active
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-white',
              )}>
                {active && (
                  <motion.div 
                    layoutId="desktop-nav-bg"
                    className="absolute inset-0 bg-white/10 border border-white/10 rounded-2xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={cn(
                  "h-5 w-5 shrink-0 relative z-10 transition-transform duration-300",
                  active ? "scale-110" : "group-hover:scale-110"
                )} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[15px] font-semibold relative z-10">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileNav() {
  const isActive = useActiveNav();

  return (
    <nav
      className="sm:hidden shrink-0 bg-background/80 backdrop-blur-3xl border-t border-white/10 z-50 relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />
      <div className="h-20 flex items-center justify-around px-2 relative z-10">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 py-2 px-3 flex-1 h-full"
            >
              <div className="relative flex items-center justify-center w-12 h-8">
                {active && (
                  <motion.div 
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 bg-primary/20 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn(
                    'relative z-10 h-[22px] w-[22px] transition-all duration-300',
                    active ? 'text-primary scale-110' : 'text-muted-foreground scale-100 group-hover:text-white',
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>
              <span className={cn(
                'text-[10px] font-bold leading-none tracking-wide transition-colors truncate',
                active ? 'text-white' : 'text-muted-foreground',
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Navigation() {
  return (
    <>
      <DesktopSidebar />
      <MobileNav />
    </>
  );
}
