import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';

import { MusicKitProvider } from '@/context/MusicKitContext';
import { PlayerProvider } from '@/context/AudioPlayerContext';
import { Navigation } from '@/components/Navigation';
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

// Page transition variants — snappy iOS-style cross-fade with a subtle lift
const pageVariants = {
  initial: { opacity: 0, y: 7 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: 'easeIn' as const },
  },
};

// ── Inner shell — has access to MusicKit context ──────────────────────────────

function AppShell() {
  const [location] = useLocation();

  // Key by first path segment so tab switches animate,
  // sub-navigation within a tab (e.g. /song/:id) also gets its own transition.
  // Using full location gives each page its own key.
  const pageKey = location;

  return (
    <div className="min-h-[100dvh] flex flex-col sm:flex-row bg-background">
      <Navigation />

      {/* Main content area — clears the fixed bottom nav on mobile */}
      <main
        className="flex-1 relative flex flex-col sm:ml-56 overflow-hidden"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Tailwind class handles desktop: override the padding */}
        <style>{`@media (min-width: 640px) { main { padding-bottom: 0 !important; } }`}</style>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageKey}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 w-full mx-auto"
          >
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/collection" component={Collection} />
              <Route path="/song/:id" component={SongDetail} />
              <Route path="/playlists" component={Playlists} />
              <Route path="/playlists/:id" component={PlaylistDetail} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </motion.div>
        </AnimatePresence>
      </main>

      <MiniPlayer />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

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
