// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// Replace these with your actual Supabase credentials
// Get them from: Supabase Dashboard → Settings → API

const SUPABASE_CONFIG = {
  // Your Supabase project URL
  url: 'https://vnoqbvhtmozkudujwrtn.supabase.co',
  
  // Your anon/public key (starts with eyJ...)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZub3Fidmh0bW96a3VkdWp3cnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjgzMDQsImV4cCI6MjA5ODc0NDMwNH0.PJelWUUhcmmT8cqY7u8yKmjMVRjz8JTNDml95bhzrkw',
  
  // Google OAuth Settings
  google: {
    enabled: true,
    redirectTo: window.location.origin + window.location.pathname
  }
};

// Make config available globally
window.SUPABASE_CONFIG = SUPABASE_CONFIG;