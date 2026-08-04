import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Library, ListMusic, User, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: Home, label: 'Player' },
    { href: '/collection', icon: Library, label: 'Collection' },
    { href: '/playlists', icon: ListMusic, label: 'Playlists' },
    { href: '/profile', icon: User, label: 'Profile' },
    { href: '/add', icon: PlusCircle, label: 'Add' },
  ];

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 flex items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center w-full h-full">
              <div className={cn(
                "flex flex-col items-center justify-center w-12 h-12 rounded-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden sm:flex fixed top-0 bottom-0 left-0 w-64 bg-card border-r border-border z-50 flex-col py-8 px-4">
        <div className="mb-8 px-4 flex items-center gap-3 text-primary">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <ListMusic className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold font-mono tracking-tight">Maplog</span>
        </div>

        <div className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
