-- Atualização complementar para a tela de gerenciamento de usuários.
-- Execute no Supabase SQL Editor depois do SQL principal de aprovação.

-- Administradores já conseguem consultar todos os perfis pela política
-- existente "admin manage profiles". Gerentes podem consultar apenas
-- perfis pendentes, para que a tela mostre as solicitações que podem aprovar.
DROP POLICY IF EXISTS "manager read pending profiles" ON public.profiles;
CREATE POLICY "manager read pending profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  approval_status = 'pending'
  AND public.current_app_role() = 'manager'
);

-- A função de aprovação já é executável por authenticated no SQL principal.
-- Garantir SELECT para a tela de histórico (a RLS limita aos administradores).
GRANT SELECT ON public.profile_approval_history TO authenticated;
