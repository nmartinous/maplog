import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { MusicKitProvider, useMusicKit } from '@/context/MusicKitContext';
import { PlayerProvider } from '@/context/AudioPlayerContext';
import { Navigation } from '@/components/Navigation';
import { MiniPlayer } from '@/components/MiniPlayer';

import Home from '@/pages/Home';
import Collection from '@/pages/Collection';
import SongDetail from '@/pages/SongDetail';
import Setup from '@/pages/Setup';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// ── Inner shell — has access to MusicKit context ──────────────────────────────

function AppShell() {
  const { hasToken } = useMusicKit();

  // No developer token yet → show the one-time setup screen
  if (!hasToken) {
    return <Setup />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col sm:flex-row bg-background">
      <Navigation />
      <main className="flex-1 relative flex flex-col sm:ml-64 pb-16 sm:pb-0">
        <div className="flex-1 w-full mx-auto">
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
        </div>
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
