-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE USING (auth.uid() = id);

-- RLS Policies for projects table
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for requests table
CREATE POLICY "requests_select_own" ON public.requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "requests_insert_own" ON public.requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "requests_update_own" ON public.requests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "requests_delete_own" ON public.requests
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for change_orders table
CREATE POLICY "change_orders_select_own" ON public.change_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "change_orders_insert_own" ON public.change_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "change_orders_update_own" ON public.change_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "change_orders_delete_own" ON public.change_orders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for templates table
CREATE POLICY "templates_select_own" ON public.templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "templates_insert_own" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "templates_update_own" ON public.templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "templates_delete_own" ON public.templates
  FOR DELETE USING (auth.uid() = user_id);
