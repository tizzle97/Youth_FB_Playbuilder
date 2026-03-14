import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    
    if (newUsername) {
      if (newUsername.length < 3) {
        setError('Username must be at least 3 characters long');
      } else if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        setError('Username can only contain letters, numbers, underscores, and hyphens');
      } else {
        setError('');
      }
    } else {
      setError('');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess('Password reset instructions have been sent to your email.');
      setTimeout(() => {
        setIsResetMode(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send reset instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!username) {
          throw new Error('Username is required');
        }
        
        if (username.length < 3) {
          throw new Error('Username must be at least 3 characters long');
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }

        const { data: { user: existingUser }, error: checkError } = await supabase.auth.getUser(email);
        
        if (existingUser) {
          setError('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setError('This email is already registered. Please sign in instead.');
          } else {
            setError(signUpError.message);
          }
        } else {
          setSuccess('Account created successfully! You can now sign in.');
          setTimeout(() => {
            setIsSignUp(false);
            setSuccess('');
          }, 3000);
        }
      } else {
        const { error: signInError, data } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          if (signInError.message === 'Invalid login credentials') {
            setError('Invalid email or password. Please try again.');
          } else {
            setError(signInError.message);
          }
        } else if (data.user) {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-board flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-board-light p-8 rounded-xl border border-chalk/10">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-chalk">
            {isResetMode 
              ? 'Reset your password'
              : isSignUp 
                ? 'Create your account' 
                : 'Sign in to your account'}
          </h2>
          {!isResetMode && (
            <p className="mt-2 text-center text-sm text-chalk/70">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccess('');
                  setUsername('');
                  setEmail('');
                  setPassword('');
                }}
                className="font-medium text-primary hover:text-primary-dark transition-colors"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          )}
        </div>

        <form className="mt-8 space-y-6" onSubmit={isResetMode ? handlePasswordReset : handleSubmit}>
          {isResetMode ? (
            <div>
              <p className="text-chalk/70 mb-4">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-chalk/20 bg-board placeholder-chalk/50 text-chalk rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Email address"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md shadow-sm space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="username" className="sr-only">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-chalk/50" />
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={handleUsernameChange}
                      className={`appearance-none relative block w-full pl-10 pr-3 py-2 border ${
                        error && username ? 'border-red-500' : 'border-chalk/20'
                      } bg-board placeholder-chalk/50 text-chalk rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`}
                      placeholder="Username"
                      minLength={3}
                      maxLength={30}
                      pattern="[a-zA-Z0-9_-]+"
                      title="Username can only contain letters, numbers, underscores, and hyphens"
                    />
                  </div>
                  <p className="mt-1 text-sm text-chalk/50">
                    Username must be at least 3 characters long and can only contain letters, numbers, underscores, and hyphens.
                  </p>
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-chalk/20 bg-board placeholder-chalk/50 text-chalk rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full pl-10 pr-3 py-2 border border-chalk/20 bg-board placeholder-chalk/50 text-chalk rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Password"
                    minLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-500/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-500 text-sm text-center bg-green-500/10 p-3 rounded-lg">
              {success}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || (isSignUp && !!error)}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <ArrowRight className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              {loading 
                ? 'Processing...' 
                : isResetMode 
                  ? 'Send Reset Instructions'
                  : isSignUp 
                    ? 'Sign up' 
                    : 'Sign in'}
            </button>
          </div>

          {!isSignUp && !isResetMode && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(true);
                  setError('');
                  setSuccess('');
                }}
                className="text-primary hover:text-primary-dark text-sm transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          )}

          {isResetMode && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-primary hover:text-primary-dark text-sm transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}