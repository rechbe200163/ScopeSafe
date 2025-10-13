-- This script will be used to seed a default template for users
-- Note: This will be executed after user creation, so we'll handle it in the app
-- For now, we'll just create a function that can be called

CREATE OR REPLACE FUNCTION public.create_default_template(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.templates (user_id, name, reply_template, is_default)
  VALUES (
    p_user_id,
    'Default Template',
    E'Hi [Client Name],\n\nThank you for your request. After reviewing your message, I''ve determined that this work falls outside the original project scope.\n\n[Analysis]\n\nI''ve prepared a change order with the following details:\n- Estimated Hours: [Hours]\n- Estimated Cost: [Cost]\n\nPlease review the attached change order and let me know if you have any questions.\n\nBest regards,\n[Your Name]',
    TRUE
  )
  ON CONFLICT DO NOTHING;
END;
$$;
