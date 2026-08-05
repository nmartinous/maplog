import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';

import { MusicKitProvider } from '@/context/MusicKitContext';
import { PlayerProvider } from '@/context/AudioPlayerContext';
import { DesktopSidebar, MobileNav } from '@/components/Navigation';
import { MiniPlayer } from '@/components/MiniPlayer';

import Home from '@/pages/Home';
import Collection from '@/pages/Collection';
import SongDetail from '@/pages/SongDetail';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const pageVariants = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: 0.16, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.08, ease: 'easeIn' as const },
  },
};

function AppShell() {
  const [location] = useLocation();

  return (
    /*
      Root shell: fills exactly the visual viewport (100dvh) and hides overflow so the
      document body never scrolls — all scrolling happens inside individual page containers.

      Mobile layout (flex-col):
        ┌──────────────────┐  ↑
        │   <main>         │  flex-1 (page content, scrollable internally)
        ├──────────────────┤
        │   <MiniPlayer>   │  shrink-0 h-16
        ├──────────────────┤
        │   <MobileNav>    │  shrink-0 h-16 + safe-area padding
        └──────────────────┘  ↓

      Desktop layout (flex-row, sm+):
        ┌────────┬─────────────────────┐
        │        │   <main>            │  flex-1 (page content)
        │ Sidebar├─────────────────────┤
        │  w-56  │   <MiniPlayer>      │  shrink-0 h-16
        │        │ (MobileNav hidden)  │
        └────────┴─────────────────────┘
    */
    <div className="h-dvh overflow-hidden flex flex-col sm:flex-row bg-background">
      {/* Desktop sidebar — in-flow, hidden on mobile via Navigation internals */}
      <DesktopSidebar />

      {/* Content column — fills the space to the right of the sidebar on desktop,
          or the full width on mobile */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {/* Page content — pages fill this with h-full and scroll internally */}
        <main className="flex-1 overflow-hidden min-h-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full flex flex-col min-h-0"
            >
              <Switch>
                <Route path="/"              component={Home} />
                <Route path="/collection"    component={Collection} />
                <Route path="/song/:id"      component={SongDetail} />
                <Route path="/playlists"     component={Playlists} />
                <Route path="/playlists/:id" component={PlaylistDetail} />
                <Route path="/profile"       component={Profile} />
                <Route path="/settings"      component={Settings} />
                <Route component={NotFound} />
              </Switch>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* MiniPlayer — always rendered, in-flow between content and nav */}
        <MiniPlayer />

        {/* Mobile bottom tab bar — in-flow at very bottom, hidden sm+ */}
        <MobileNav />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MusicKitProvider>
        <PlayerProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AppShell />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PlayerProvider>
      </MusicKitProvider>
    </QueryClientProvider>
  );
}

export default App;
