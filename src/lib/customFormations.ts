import { supabase } from './supabase';
import type { FormationTemplate } from '../components/designer/formations';
import type { PlayerIcon } from '../components/designer/Canvas';
import type { PlayMetadata } from '../types/play';

type CustomFormationRow = {
  id: string;
  name: string;
  game_type: PlayMetadata['gameType'];
  icons: PlayerIcon[];
};

const toTemplate = (row: CustomFormationRow): FormationTemplate => ({
  id: row.id,
  name: row.name,
  gameType: row.game_type,
  playType: 'offense',
  icons: row.icons,
});

/** The signed-in user's own saved formations for a game type — Pro only
 *  (enforced server-side too, see custom_formations.sql). */
export async function loadCustomFormations(gameType: PlayMetadata['gameType']): Promise<FormationTemplate[]> {
  const { data, error } = await supabase
    .from('custom_formations')
    .select('id, name, game_type, icons')
    .eq('game_type', gameType)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as CustomFormationRow[]).map(toTemplate);
}

/** Saves the current canvas icon arrangement as a reusable formation. */
export async function saveCustomFormation(
  name: string,
  gameType: PlayMetadata['gameType'],
  icons: PlayerIcon[],
): Promise<FormationTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to save a formation.');

  const { data, error } = await supabase
    .from('custom_formations')
    .insert({ user_id: user.id, name, game_type: gameType, icons })
    .select('id, name, game_type, icons')
    .single();
  if (error) throw error;
  return toTemplate(data as CustomFormationRow);
}

export async function deleteCustomFormation(id: string): Promise<void> {
  const { error } = await supabase.from('custom_formations').delete().eq('id', id);
  if (error) throw error;
}
