import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

import { PlayerProvider } from '@/context/AudioPlayerContext';
import { Navigation } from '@/components/Navigation';
import { MiniPlayer } from '@/components/MiniPlayer';

import Home from '@/pages/Home';
import Collection from '@/pages/Collection';
import SongDetail from '@/pages/SongDetail';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Profile from '@/pages/Profile';
import AddSong from '@/pages/AddSong';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/not-found';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient();

function AppShell() {
  const [location] = useLocation();
  const isHome = location === '/';

  return (
    <div className="min-h-[100dvh] flex flex-col sm:flex-row bg-background">
      {!isHome && <Navigation />}
      <main className={cn(
        "flex-1 relative flex flex-col",
        !isHome ? "sm:ml-64 pb-16 sm:pb-0" : ""
      )}>
        <div className={cn("flex-1 w-full mx-auto", !isHome ? "max-w-7xl" : "")}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/collection" component={Collection} />
            <Route path="/song/:id" component={SongDetail} />
            <Route path="/playlists" component={Playlists} />
            <Route path="/playlists/:id" component={PlaylistDetail} />
            <Route path="/profile" component={Profile} />
            <Route path="/add" component={AddSong} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
      <MiniPlayer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppShell />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </PlayerProvider>
    </QueryClientProvider>
  );
}

export default App;
