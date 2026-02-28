import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://slbgnjziwlqokjtevboz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYmduanppd2xxb2tqdGV2Ym96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzkxOTgsImV4cCI6MjA4NzgxNTE5OH0.DPJYFWN7ynjotBRXdF_WJZ6w9yzQuKBbhKzYIpdVvD4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
