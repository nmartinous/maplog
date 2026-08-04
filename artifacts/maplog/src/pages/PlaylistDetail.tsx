// PlaylistDetail is no longer used — Playlists now shows a rarity-group view.
import { Redirect } from 'wouter';
export default function PlaylistDetail() {
  return <Redirect to="/playlists" />;
}
