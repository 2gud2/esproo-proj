import React, { createContext, useContext, useEffect, useState } from 'react';
import { adminAutoConfirmUser, supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

type Role = 'admin' | 'employee';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isMockMode = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://your-project.supabase.co';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check saved session in localStorage
    const saved = localStorage.getItem('espro_active_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (_) {}
    }

    if (!isMockMode) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) fetchProfile(session.user);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) fetchProfile(session.user);
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchProfile(supaUser: User) {
    let name = supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'User';
    const emailLower = (supaUser.email || '').toLowerCase();
    
    // Determine role: check user_metadata first, then email pattern (admin@ -> admin), default to employee
    let role: Role = (supaUser.user_metadata?.role as Role);
    if (!role) {
      if (emailLower.includes('admin')) {
        role = 'admin';
      } else {
        role = 'employee';
      }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, role, status')
        .eq('id', supaUser.id)
        .single();

      if (data && !error) {
        if (data.name) name = data.name;
        if (data.role) role = data.role as Role;
      }
    } catch (_) {}

    const authUser: AuthUser = {
      id: supaUser.id,
      email: supaUser.email ?? '',
      name,
      role,
    };

    setUser(authUser);
    localStorage.setItem('espro_active_user', JSON.stringify(authUser));
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const formattedEmail = email.trim().toLowerCase();

    // First try live Supabase Auth if keys present
    if (!isMockMode) {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password,
      });

      if (error && error.message.toLowerCase().includes('email not confirmed')) {
        const confirmed = await adminAutoConfirmUser(formattedEmail);
        if (confirmed) {
          const retry = await supabase.auth.signInWithPassword({
            email: formattedEmail,
            password,
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        return { error: error.message || 'Invalid email or password.' };
      }

      if (data.user) {
        await fetchProfile(data.user);
        return { error: null };
      }

      return { error: 'Invalid email or password.' };
    }

    // Fallback to local dynamic user registry
    const storedUsersJson = localStorage.getItem('espro_dynamic_users');
    const dynamicUsers = storedUsersJson ? JSON.parse(storedUsersJson) : [];

    const found = dynamicUsers.find((u: any) => u.email.toLowerCase() === formattedEmail);
    if (found) {
      if (found.status === 'disabled') {
        return { error: 'Account has been disabled by System Administrator.' };
      }

      const loggedUser: AuthUser = {
        id: found.id,
        email: found.email,
        name: found.name,
        role: found.role
      };

      setUser(loggedUser);
      localStorage.setItem('espro_active_user', JSON.stringify(loggedUser));
      return { error: null };
    }

    // Default demo account fallback
    if (formattedEmail === 'admin@espro.ph' && password === 'admin123') {
      const adminUser: AuthUser = { id: 'demo-admin', email: 'admin@espro.ph', name: 'Admin User', role: 'admin' };
      setUser(adminUser);
      localStorage.setItem('espro_active_user', JSON.stringify(adminUser));
      return { error: null };
    }

    if (formattedEmail === 'staff@espro.ph' && password === 'staff123') {
      const staffUser: AuthUser = { id: 'demo-staff', email: 'staff@espro.ph', name: 'Staff User', role: 'employee' };
      setUser(staffUser);
      localStorage.setItem('espro_active_user', JSON.stringify(staffUser));
      return { error: null };
    }

    return { error: 'Invalid email or password.' };
  }

  async function signOut() {
    localStorage.removeItem('espro_active_user');
    setUser(null);
    setSession(null);
    if (!isMockMode) {
      await supabase.auth.signOut();
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
