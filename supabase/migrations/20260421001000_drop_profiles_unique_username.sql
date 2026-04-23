create unique index if not exists drop_profiles_username_unique_idx
  on public.drop_profiles (lower(username));
