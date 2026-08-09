export interface PlayMetadata {
  gameType: '5v5' | '6v6' | '7v7' | '11v11';
  playType: 'pass' | 'run' | 'option' | 'reverse' | 'screen' | 'trick';
  formation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  description: string;
  playName: string;
  situation?: string;
  yardage?: string;
  createdBy?: string;
  createdDate?: string;
  personnel?: string;
}

export interface Play {
  id: string;
  name: string;
  type: 'offense' | 'defense';
  canvas_data: string;
  thumbnail: string;
  metadata: PlayMetadata;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  original_play_id?: string;
  is_copy?: boolean;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}