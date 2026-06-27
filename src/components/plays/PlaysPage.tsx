import React, { useState, useEffect } from 'react';
import { Book, Plus, Filter, Trash2, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AddToPlaybookButton } from './AddToPlaybookButton'; // Adjust path as needed
import { getSafeErrorMessage } from '../../lib/errors';

interface Play {
  id: string;
  name: string;
  type: 'offense' | 'defense' | 'special_teams';
  canvas_data: string;
  description: string;
  thumbnail?: string;
  user_id: string;
  is_public: boolean;
  metadata?: any;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

export function PlaysPage() {
  const [plays, setPlays] = useState<Play[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'offense' | 'defense' | 'special_teams' | 'all'>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlays = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser) {
          // User is authenticated - show their plays
          setIsAdmin(currentUser.user_metadata?.is_admin === true);

          let query = supabase
            .from('plays')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          if (filter !== 'all') {
            query = query.eq('type', filter);
          }

          const { data, error: fetchError } = await query;

          if (fetchError) throw fetchError;
          setPlays(data || []);
        } else {
          // User is not authenticated - show public plays (limited to 10)
          let query = supabase
            .from('plays')
            .select(`
              *,
              profiles(
                username,
                avatar_url
              )
            `)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(20); // Get 20 to show 10 + fade effect

          if (filter !== 'all') {
            query = query.eq('type', filter);
          }

          const { data, error: fetchError } = await query;

          if (fetchError) throw fetchError;
          setPlays(data || []);
        }
      } catch (err) {
        console.error('Error fetching plays:', err);
        setError(getSafeErrorMessage(err, 'Failed to load plays'));
      } finally {
        setLoading(false);
      }
    };

    fetchPlays();
  }, [filter]);

  const handleDeletePlay = async (playId: string) => {
    if (!confirm('Are you sure you want to delete this play? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('plays')
        .delete()
        .eq('id', playId);

      if (deleteError) throw deleteError;

      setPlays(plays.filter(play => play.id !== playId));
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to delete play'));
    }
  };

  // Fallback thumbnail generator - only used if no stored thumbnail exists
  const generateFallbackThumbnail = (play: Play) => {
    try {
      const canvasData = JSON.parse(play.canvas_data);
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      if (!ctx) return null;

      // Set canvas size with 4:3 aspect ratio
      tempCanvas.width = 400;
      tempCanvas.height = 300;

      // Draw white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Calculate field dimensions
      const yardSpacing = tempCanvas.height / 30;
      const losY = 20 * yardSpacing;
      const leftSidelineX = tempCanvas.width * 0.05;
      const rightSidelineX = tempCanvas.width * 0.95;

      // Draw field lines
      ctx.beginPath();
      ctx.strokeStyle = '#1A1A1A';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;

      // Sidelines
      ctx.moveTo(leftSidelineX, 0);
      ctx.lineTo(leftSidelineX, tempCanvas.height);
      ctx.moveTo(rightSidelineX, 0);
      ctx.lineTo(rightSidelineX, tempCanvas.height);
      ctx.stroke();

      // Line of scrimmage
      ctx.beginPath();
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      ctx.moveTo(leftSidelineX, losY);
      ctx.lineTo(rightSidelineX, losY);
      ctx.stroke();

      // Draw yard lines
      ctx.globalAlpha = 0.3;
      for (let i = 0; i <= 30; i += 5) {
        if (i === 20) continue; // Skip LOS
        const y = i * yardSpacing;
        ctx.beginPath();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.moveTo(leftSidelineX, y);
        ctx.lineTo(rightSidelineX, y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Draw paths
      canvasData.paths?.forEach((path: any) => {
        const p = new Path2D(path.path);
        ctx.strokeStyle = path.color;
        ctx.lineWidth = 3;
        ctx.stroke(p);

        // Draw arrow if exists
        if (path.arrowFrom && path.arrowTo) {
          const { x: fromX, y: fromY } = path.arrowFrom;
          const { x: toX, y: toY } = path.arrowTo;
          
          const angle = Math.atan2(toY - fromY, toX - fromX);
          const size = 15;

          ctx.save();
          ctx.translate(toX, toY);
          ctx.rotate(angle);

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-size, size/2);
          ctx.lineTo(-size, -size/2);
          ctx.closePath();

          ctx.fillStyle = path.color;
          ctx.fill();
          ctx.restore();
        }
      });

      // Draw player icons
      canvasData.icons?.forEach((icon: any) => {
        const size = 24;
        ctx.fillStyle = icon.color;
        
        if (icon.isSquare) {
          ctx.fillRect(icon.x - size/2, icon.y - size/2, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(icon.x, icon.y, size/2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon.letter, icon.x, icon.y);
      });

      return tempCanvas.toDataURL();
    } catch (err) {
      console.error('Error generating fallback thumbnail:', err);
      return null;
    }
  };

  const getThumbnailSrc = (play: Play) => {
    // First, try to use the stored thumbnail
    if (play.thumbnail && play.thumbnail.startsWith('data:image/')) {
      return play.thumbnail;
    }
    
    // Fallback to generating thumbnail from canvas data
    return generateFallbackThumbnail(play);
  };

  const ThumbnailImage = ({ play }: { play: Play }) => {
    const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      const src = getThumbnailSrc(play);
      setThumbnailSrc(src);
      setImageError(false);
    }, [play]);

    const handleImageError = () => {
      setImageError(true);
      // Try fallback thumbnail if stored thumbnail fails
      if (play.thumbnail && !imageError) {
        const fallback = generateFallbackThumbnail(play);
        setThumbnailSrc(fallback);
      }
    };

    if (!thumbnailSrc) {
      return (
        <div className="w-full h-full bg-board-light flex items-center justify-center">
          <div className="text-chalk/30 text-sm">No preview</div>
        </div>
      );
    }

    return (
      <img
        src={thumbnailSrc}
        alt={play.name}
        className="w-full h-full object-contain"
        onError={handleImageError}
        loading="lazy"
      />
    );
  };

  const visiblePlays = user ? plays : plays.slice(0, 10);
  const fadedPlays = user ? [] : plays.slice(10);

  // Require sign-in to view Community Plays
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center px-4">
        <div className="text-center">
          <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-chalk mb-4">Sign In Required</h2>
          <p className="text-chalk/70 mb-6">Please sign in to view Community Plays.</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-board-light rounded-xl border border-chalk/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-chalk/10">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-chalk flex items-center gap-2">
                <Book className="h-6 w-6 text-primary" />
                {user ? 'My Plays' : 'Community Plays'}
              </h1>
              {user && (
                <Link
                  to="/designer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Play
                </Link>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-chalk/50" />
              <div className="flex gap-2">
                {(['all', 'offense', 'defense', 'special_teams'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-1 text-sm rounded-md capitalize ${
                      filter === type
                        ? 'bg-primary text-white'
                        : 'text-chalk/70 hover:text-chalk hover:bg-board'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 relative">
            {error ? (
              <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-board rounded-lg aspect-[4/3] mb-2"></div>
                    <div className="h-4 bg-board rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : plays.length === 0 ? (
              <div className="text-center py-12">
                <Book className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-chalk mb-2">
                  {user ? 'No plays found' : 'No public plays available'}
                </h3>
                <p className="text-chalk/70">
                  {user ? (
                    filter === 'all'
                      ? "You haven't created any plays yet"
                      : `No ${filter.replace('_', ' ')} plays found`
                  ) : (
                    'Check back later for community plays'
                  )}
                </p>
                {user && (
                  <Link
                    to="/designer"
                    className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Play
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Visible plays */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {visiblePlays.map((play) => (
    <div key={play.id} className="group relative">
      {user ? (
        <>
          {/* Play Preview */}
          <Link to={`/designer?play=${play.id}`} className="block">
            <div className="bg-board rounded-lg overflow-hidden aspect-[4/3] mb-2 border border-chalk/10 group-hover:border-primary/30 transition-colors">
              <ThumbnailImage play={play} />
            </div>
            <h3 className="text-chalk group-hover:text-primary transition-colors mb-1">
              {play.name}
            </h3>
            <p className="text-sm text-chalk/50 capitalize mb-3">
              {play.type.replace('_', ' ')}
            </p>
          </Link>

          {/* Action buttons for authenticated users */}
          <div className="flex items-center gap-2">
            <AddToPlaybookButton 
              playId={play.id}
              playName={play.name}
              onSuccess={() => {
                // Optional: Show success notification
                console.log(`"${play.name}" added to playbook successfully!`);
              }}
            />
            
            {isAdmin && (
              <button
                onClick={() => handleDeletePlay(play.id)}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                title="Delete Play"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        /* Existing non-authenticated user view */
        <div className="block">
          <div className="bg-board rounded-lg overflow-hidden aspect-[4/3] mb-2 border border-chalk/10">
            <ThumbnailImage play={play} />
          </div>
          <h3 className="text-chalk">
            {play.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-chalk/50 capitalize">
              {play.type.replace('_', ' ')}
            </p>
            {play.profiles && (
              <p className="text-xs text-chalk/40">
                by {play.profiles.username || 'Anonymous'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  ))}
</div>

                {/* Faded plays for non-authenticated users */}
                {!user && fadedPlays.length > 0 && (
                  <div className="relative mt-6">
                    {/* Fade overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-board/50 to-board z-10 pointer-events-none"></div>
                    
                    {/* Faded plays */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-30">
                      {fadedPlays.map((play) => (
                        <div key={play.id} className="group relative">
                          <div className="bg-board rounded-lg overflow-hidden aspect-[4/3] mb-2 border border-chalk/10">
                            <ThumbnailImage play={play} />
                          </div>
                          <h3 className="text-chalk">
                            {play.name}
                          </h3>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-chalk/50 capitalize">
                              {play.type.replace('_', ' ')}
                            </p>
                            {play.profiles && (
                              <p className="text-xs text-chalk/40">
                                by {play.profiles.username || 'Anonymous'}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sign up message */}
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <div className="bg-board-light border border-chalk/20 rounded-xl p-8 text-center max-w-md mx-4 shadow-xl">
                        <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-chalk mb-2">
                          Want to see more plays?
                        </h3>
                        <p className="text-chalk/70 mb-6">
                          Create an account to access hundreds of plays, create your own, and join our community of coaches.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={() => navigate('/auth')}
                            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium"
                          >
                            Sign Up Free
                          </button>
                          <button
                            onClick={() => navigate('/auth')}
                            className="px-6 py-3 border border-chalk/20 text-chalk hover:bg-board rounded-lg transition-colors"
                          >
                            Sign In
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}