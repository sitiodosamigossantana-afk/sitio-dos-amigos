-- SÍTIO DOS AMIGOS — permissões para sincronização dos dados operacionais
-- Execute uma única vez no SQL Editor do projeto Supabase.
-- Não apaga dados e não altera as regras da tabela profiles.

-- Ativa RLS nas tabelas operacionais.
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Leitura dos dados compartilhados por qualquer usuário autenticado.
DROP POLICY IF EXISTS sitio_menu_select ON public.menu_items;
CREATE POLICY sitio_menu_select ON public.menu_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sitio_stock_select ON public.stock_items;
CREATE POLICY sitio_stock_select ON public.stock_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sitio_clients_select ON public.clients;
CREATE POLICY sitio_clients_select ON public.clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sitio_sales_select ON public.sales;
CREATE POLICY sitio_sales_select ON public.sales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sitio_expenses_select ON public.expenses;
CREATE POLICY sitio_expenses_select ON public.expenses FOR SELECT TO authenticated USING (public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_recipes_select ON public.recipes;
CREATE POLICY sitio_recipes_select ON public.recipes FOR SELECT TO authenticated USING (true);

-- Cardápio e receitas: somente administrador e gerente podem alterar.
DROP POLICY IF EXISTS sitio_menu_insert ON public.menu_items;
CREATE POLICY sitio_menu_insert ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_menu_update ON public.menu_items;
CREATE POLICY sitio_menu_update ON public.menu_items FOR UPDATE TO authenticated USING (public.current_app_role() IN ('admin','manager')) WITH CHECK (public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_menu_delete ON public.menu_items;
CREATE POLICY sitio_menu_delete ON public.menu_items FOR DELETE TO authenticated USING (public.current_app_role() IN ('admin','manager'));

DROP POLICY IF EXISTS sitio_stock_insert ON public.stock_items;
CREATE POLICY sitio_stock_insert ON public.stock_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
-- UPDATE também é necessário para a baixa automática de estoque ao vender.
DROP POLICY IF EXISTS sitio_stock_update ON public.stock_items;
CREATE POLICY sitio_stock_update ON public.stock_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS sitio_stock_delete ON public.stock_items;
CREATE POLICY sitio_stock_delete ON public.stock_items FOR DELETE TO authenticated USING (public.current_app_role() IN ('admin','manager'));

DROP POLICY IF EXISTS sitio_recipes_insert ON public.recipes;
CREATE POLICY sitio_recipes_insert ON public.recipes FOR INSERT TO authenticated WITH CHECK (public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_recipes_delete ON public.recipes;
CREATE POLICY sitio_recipes_delete ON public.recipes FOR DELETE TO authenticated USING (public.current_app_role() IN ('admin','manager'));

-- Clientes e vendas podem ser registrados pela equipe autenticada.
DROP POLICY IF EXISTS sitio_clients_insert ON public.clients;
CREATE POLICY sitio_clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS sitio_clients_update ON public.clients;
CREATE POLICY sitio_clients_update ON public.clients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS sitio_sales_insert ON public.sales;
CREATE POLICY sitio_sales_insert ON public.sales FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS sitio_sales_update ON public.sales;
CREATE POLICY sitio_sales_update ON public.sales FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Despesas: somente administrador e gerente.
DROP POLICY IF EXISTS sitio_expenses_insert ON public.expenses;
CREATE POLICY sitio_expenses_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_expenses_update ON public.expenses;
CREATE POLICY sitio_expenses_update ON public.expenses FOR UPDATE TO authenticated USING (public.current_app_role() IN ('admin','manager')) WITH CHECK (public.current_app_role() IN ('admin','manager'));
DROP POLICY IF EXISTS sitio_expenses_delete ON public.expenses;
CREATE POLICY sitio_expenses_delete ON public.expenses FOR DELETE TO authenticated USING (public.current_app_role() IN ('admin','manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.recipes TO authenticated;
