
-- Drop the existing SELECT policy on posts
DROP POLICY "Anyone can view public posts" ON public.posts;

-- Create new policy that allows anyone to see all posts (frontend handles content gating)
CREATE POLICY "Anyone can view all posts"
ON public.posts
FOR SELECT
USING (true);
