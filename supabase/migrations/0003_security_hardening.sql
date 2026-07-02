-- Advisor fixes: pin function search_path and stop clients calling the
-- signup trigger function via the REST RPC surface.
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = 'public';
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
