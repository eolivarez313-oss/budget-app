import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://anyiqxrsasdhkwxdqlww.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFueWlxeHJzYXNkaGt3eGRxbHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTExMjgsImV4cCI6MjA5ODQyNzEyOH0.6_u7aoWnGbpE3vh8IX0lJkaxB7UWKT1SAE2kNXIuO9Q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
