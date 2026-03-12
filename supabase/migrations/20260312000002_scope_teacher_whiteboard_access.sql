-- Scope teacher whiteboard visibility to only their own students' whiteboards
-- Previously teachers could view ALL whiteboards in the system

DROP POLICY IF EXISTS "Teachers can view all whiteboards" ON public.whiteboards;

CREATE POLICY "Teachers can view their students whiteboards" ON public.whiteboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE c.teacher_id = auth.uid()
        AND cm.student_id = whiteboards.user_id
    )
  );
