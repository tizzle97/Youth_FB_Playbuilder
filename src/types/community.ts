export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  reputation: number;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  user: User;
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  upvotes: number;
  downvotes: number;
  user: User;
}

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';