-- SÍTIO DOS AMIGOS — habilitar eventos em tempo real para sincronização entre aparelhos
-- As tabelas já possuem RLS/políticas. Este comando apenas as adiciona à publicação Realtime.
-- Pode ser executado mais de uma vez: verifica antes se cada tabela já está publicada.

DO $$
DECLARE
    tabela text;
BEGIN
    FOREACH tabela IN ARRAY ARRAY[
        'menu_items',
        'stock_items',
        'clients',
        'sales',
        'expenses',
        'recipes'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = tabela
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
        END IF;
    END LOOP;
END $$;
