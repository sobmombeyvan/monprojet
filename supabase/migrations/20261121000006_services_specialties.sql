-- ════════════════════════════════════════════════════════════════════
-- Services proposés par les consultants (table `specialties`) — liste phase 3
-- Idempotent : ajoute les nouvelles entrées, renomme « Visa touristique ».
-- Les anciennes spécialités sont conservées (déjà utilisées par des consultants).
-- ════════════════════════════════════════════════════════════════════
insert into public.specialties (slug, name_fr, name_en) values
  ('international-mobility', 'Immigration et mobilité internationale', 'Immigration and international mobility'),
  ('study-abroad', 'Études à l''étranger', 'Studying abroad'),
  ('work-immigration', 'Immigration professionnelle', 'Work immigration'),
  ('tourist-visa', 'Visa touristique et visite familiale', 'Tourist visa and family visit'),
  ('family-reunification', 'Regroupement familial', 'Family reunification'),
  ('permanent-residence', 'Résidence permanente', 'Permanent residence'),
  ('academic-orientation', 'Orientation académique', 'Academic guidance'),
  ('profile-assessment', 'Évaluation de profil', 'Profile assessment'),
  ('application-preparation', 'Préparation administrative de dossiers', 'Administrative file preparation'),
  ('settlement-integration', 'Installation et intégration à l''étranger', 'Settlement and integration abroad')
on conflict (slug) do update set name_fr = excluded.name_fr, name_en = excluded.name_en;
