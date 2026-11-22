update public.platform_settings
set value = jsonb_set(value, '{phone}', to_jsonb('+237 692 01 82 19'::text), true),
    updated_at = now()
where key = 'contact';
