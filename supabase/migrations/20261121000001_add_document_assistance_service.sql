insert into public.services (slug, name_fr, name_en, description_fr, description_en, icon, pricing_type, base_price, currency, default_duration_minutes, is_bookable, sort_order) values
  ('procedural-document-assistance', 'Assistance documentaire', 'Document Assistance',
   U&'Aide \00e0 la pr\00e9paration, \00e0 la v\00e9rification et \00e0 l''organisation de vos documents. Prix sur devis.',
   'Help preparing, reviewing and organizing your documents. Price upon quotation.',
   'FileStack', 'quote', null, 'XAF', 60, false, 4)
on conflict (slug) do nothing;
