-- Normalize next_id functions: remove ambiguous overload and create
-- a canonical next_id(p_prefix text) that uses id_tracker.

-- Drop potentially ambiguous overload that accepts a defaulted integer
DROP FUNCTION IF EXISTS public.next_id(text, integer);

-- Create canonical next_id(p_prefix text)
CREATE OR REPLACE FUNCTION public.next_id(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cur int;
BEGIN
  -- Atomically increment if existing
  UPDATE public.id_tracker
  SET current_value = current_value + 1
  WHERE prefix = p_prefix;

  SELECT current_value INTO v_cur
  FROM public.id_tracker
  WHERE prefix = p_prefix
  LIMIT 1;

  -- If not present, create with initial value 1
  IF v_cur IS NULL THEN
    INSERT INTO public.id_tracker(prefix, current_value)
    VALUES (p_prefix, 1)
    RETURNING current_value INTO v_cur;
  END IF;

  RETURN p_prefix || '-' || lpad(v_cur::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_id(text) TO anon;
