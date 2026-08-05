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

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: 0.18, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.09, ease: 'easeIn' as const },
  },
};

function AppShell() {
  const [location] = useLocation();

  return (
    // Bare flex wrapper — no height set here; .app-main owns the viewport sizing
    <div className="flex flex-col sm:flex-row bg-background">
      {/* Fixed nav — not in flow */}
      <Navigation />

      {/*
        .app-main (index.css):
          mobile  → height = 100dvh - nav(4rem + safe-area) - miniplayer(4rem)
          desktop → height = 100dvh - miniplayer(4rem),  margin-left = 14rem (w-56)
        Every page fills h-full and never overlaps chrome.
      */}
      <main className="app-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            // Fill main completely — pages get a definite height via h-full
            className="h-full flex flex-col min-h-0"
          >
            <Switch>
              <Route path="/"            component={Home} />
              <Route path="/collection"  component={Collection} />
              <Route path="/song/:id"    component={SongDetail} />
              <Route path="/playlists"   component={Playlists} />
              <Route path="/playlists/:id" component={PlaylistDetail} />
              <Route path="/profile"     component={Profile} />
              <Route path="/settings"    component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed MiniPlayer — .miniplayer (index.css) handles responsive position */}
      <MiniPlayer />
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
