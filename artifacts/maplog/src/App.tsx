import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

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
import Conflicts from '@/pages/Conflicts';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function AppShell() {
  return (
    <div className="h-dvh flex flex-col sm:flex-row bg-background overflow-hidden w-full">
      <DesktopSidebar />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full relative z-10">
        <main className="flex-1 min-h-0 relative w-full overflow-hidden bg-background">
          <Switch>
            <Route path="/"              component={Home} />
            <Route path="/collection"    component={Collection} />
            <Route path="/song/:id"      component={SongDetail} />
            <Route path="/playlists"     component={Playlists} />
            <Route path="/playlists/:id" component={PlaylistDetail} />
            <Route path="/profile"       component={Profile} />
            <Route path="/settings"      component={Settings} />
            <Route path="/conflicts"     component={Conflicts} />
            <Route component={NotFound} />
          </Switch>
        </main>

        <MiniPlayer />
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