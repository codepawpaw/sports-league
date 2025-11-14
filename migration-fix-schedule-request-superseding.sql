-- Add 'superseded' to the status check constraint for match_schedule_requests
ALTER TABLE public.match_schedule_requests 
DROP CONSTRAINT IF EXISTS match_schedule_requests_status_check;

ALTER TABLE public.match_schedule_requests 
ADD CONSTRAINT match_schedule_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'));

-- Create a stored procedure to handle schedule approval atomically
CREATE OR REPLACE FUNCTION public.handle_schedule_approval(
  p_match_id UUID,
  p_request_id UUID,
  p_new_scheduled_date TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
BEGIN
  -- Mark any previous approved requests as superseded
  UPDATE public.match_schedule_requests 
  SET 
    status = 'superseded',
    reviewed_at = NOW(),
    reviewed_by = 'system (auto-superseded)'
  WHERE 
    match_id = p_match_id 
    AND status = 'approved' 
    AND id != p_request_id;

  -- Update the match scheduled_at time
  UPDATE public.matches 
  SET 
    scheduled_at = p_new_scheduled_date,
    updated_at = NOW()
  WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_schedule_approval(UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
