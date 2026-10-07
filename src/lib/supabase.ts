import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function createStaffAccount(email: string, password: string, name: string, role: 'admin' | 'employee') {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project.supabase.co') {
    return { user: null, error: null };
  }

  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE ?? '';
  if (serviceRoleKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (error) return { user: null, error: error.message };

    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          role,
          status: 'active',
          email
        });
      } catch (_) {}
    }

    return { user: data.user, error: null };
  }

  // Fallback to standard signUp if service role key is not configured
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: {
      data: { name, role }
    }
  });

  if (error) return { user: null, error: error.message };

  if (data.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name,
        role,
        status: 'active',
        email
      });
    } catch (_) {}
  }

  return { user: data.user, error: null };
}

export async function adminAutoConfirmUser(email: string) {
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE ?? '';
  if (!supabaseUrl || !serviceRoleKey) return false;

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data } = await adminClient.auth.admin.listUsers();
    const userToConfirm = data?.users.find((u: User) => u.email?.toLowerCase() === email.toLowerCase());

    if (userToConfirm) {
      const { error } = await adminClient.auth.admin.updateUserById(userToConfirm.id, {
        email_confirm: true
      });
      return !error;
    }
  } catch (_) {}

  return false;
}

export async function adminUpdateUserPassword(userId: string, newPassword: string) {
  if (userId.startsWith('u-')) {
    // Local mock user, not stored in Supabase Auth
    return { data: null, error: null };
  }

  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: new Error('Supabase service role key is not configured in .env (VITE_SUPABASE_SERVICE_ROLE).') };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  return { data, error: error ? new Error(error.message) : null };
}
