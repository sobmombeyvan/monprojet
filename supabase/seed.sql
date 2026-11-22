-- ════════════════════════════════════════════════════════════════════
-- Seed data (DEVELOPMENT / DEMO ONLY — never run in production)
-- Demo accounts (password for all: Demo#2026):
--   admin@monprojet.dev   → admin
--   client@monprojet.dev  → client
--   *.consultant@monprojet.dev → consultants
-- Demo consultants are fictitious people. Country texts are generic
-- overviews: visa requirements are intentionally NOT seeded — they must be
-- entered by editors from official sources with a verification date.
-- ════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

insert into public.roles (key, label_fr, label_en) values
  ('client', 'Client', 'Client'),
  ('consultant', 'Consultant', 'Consultant'),
  ('editor', 'Éditeur', 'Editor'),
  ('admin', 'Administrateur', 'Administrator'),
  ('super_admin', 'Super administrateur', 'Super administrator')
on conflict (key) do nothing;

insert into public.platform_settings (key, value, description, is_public) values
  ('commission_rate', '0.20', 'Commission plateforme par défaut (0–1)', false),
  ('booking_hold_minutes', '15', 'Durée de réservation temporaire du créneau pendant le paiement', true),
  ('cancellation_policy', '{"free_until_hours": 24, "reschedule_until_hours": 24}', 'Politique d''annulation et de report', true),
  ('supported_currencies', '["XAF", "EUR", "USD"]', 'Devises acceptées', true),
  ('exchange_rates', '{"XAF": 1, "EUR": 655.957, "USD": 600}', 'Taux indicatifs (XAF par unité) — à mettre à jour par un admin', true),
  ('contact', '{"email": "contact@monprojet.com", "phone": "+237 692 01 82 19", "city": "Yaoundé, Cameroun"}', 'Coordonnées affichées', true)
on conflict (key) do nothing;

insert into public.languages (code, name_fr, name_en) values
  ('fr', 'Français', 'French'), ('en', 'Anglais', 'English'), ('de', 'Allemand', 'German'),
  ('es', 'Espagnol', 'Spanish'), ('it', 'Italien', 'Italian'), ('pt', 'Portugais', 'Portuguese'),
  ('ar', 'Arabe', 'Arabic'), ('zh', 'Chinois', 'Chinese'), ('ro', 'Roumain', 'Romanian')
on conflict do nothing;

insert into public.specialties (slug, name_fr, name_en) values
  ('study-visa', 'Visa étudiant', 'Study visa'),
  ('work-permit', 'Permis de travail', 'Work permit'),
  ('permanent-residence', 'Résidence permanente', 'Permanent residence'),
  ('family-reunification', 'Regroupement familial', 'Family reunification'),
  ('tourist-visa', 'Visa touristique', 'Tourist visa'),
  ('university-admission', 'Admission universitaire', 'University admission'),
  ('career-orientation', 'Orientation professionnelle', 'Career guidance'),
  ('ausbildung', 'Ausbildung (formation en alternance)', 'Ausbildung (vocational training)'),
  ('document-review', 'Revue de dossier', 'Application review')
on conflict do nothing;

insert into public.categories (slug, name_fr, name_en, sort_order) values
  ('study-abroad', 'Études à l''étranger', 'Study Abroad', 1),
  ('work-abroad', 'Travailler à l''étranger', 'Work Abroad', 2),
  ('tourist-visas', 'Visas touristiques', 'Tourist Visas', 3),
  ('immigration', 'Immigration', 'Immigration', 4),
  ('permanent-residence', 'Résidence permanente', 'Permanent Residence', 5),
  ('opportunities', 'Opportunités internationales', 'International Opportunities', 6),
  ('country-guides', 'Guides pays', 'Country Guides', 7),
  ('updates', 'Actualités immigration', 'Immigration Updates', 8)
on conflict do nothing;

-- Services (§8) — prices editable in /admin/settings
insert into public.services (slug, name_fr, name_en, description_fr, description_en, icon, pricing_type, base_price, currency, default_duration_minutes, is_bookable, sort_order) values
  ('consultation', 'Consultation avec un expert', 'Consultation with an Expert',
   'Échangez avec un expert qualifié sur votre projet de mobilité internationale.',
   'Talk to a qualified expert about your international mobility project.',
   'MessagesSquare', 'fixed', 15000, 'XAF', 45, true, 1),
  ('profile-assessment', 'Évaluation de profil personnalisée', 'Personalized Profile Assessment',
   'Analyse approfondie de votre profil et des options adaptées à votre situation.',
   'In-depth analysis of your profile and the options that fit your situation.',
   'ClipboardCheck', 'fixed', 25000, 'XAF', 60, true, 2),
  ('procedural-assistance', 'Assistance procédurale', 'Procedural Assistance',
   'Accompagnement dans la constitution et le suivi de votre dossier. Prix sur devis.',
   'Support preparing and following up your application. Price upon quotation.',
   'FileStack', 'quote', null, 'XAF', 60, false, 3),
  ('procedural-document-assistance', 'Assistance documentaire', 'Document Assistance',
   U&'Aide \00e0 la pr\00e9paration, \00e0 la v\00e9rification et \00e0 l''organisation de vos documents. Prix sur devis.',
   'Help with preparing, checking and organizing your documents. Price upon quotation.',
   'FileStack', 'quote', null, 'XAF', 60, false, 4)
on conflict (slug) do nothing;

insert into public.countries (slug, iso2, name_fr, name_en, region, lon, lat, is_popular, main_languages, goals, opportunities_fr, opportunities_en, overview_fr, overview_en, official_links, source_name, source_url, aliases, status) 
select v.slug, v.iso2, v.name_fr, v.name_en, v.region::public.region, v.lon, v.lat, v.is_popular, v.main_languages, v.goals, v.opportunities_fr::jsonb, v.opportunities_en::jsonb, v.overview_fr, v.overview_en, v.official_links::jsonb, v.source_name, v.source_url, v.aliases, 'published'::public.content_status from (values
  ('canada', 'CA', 'Canada', 'Canada', 'north_america', -73.6, 45.5, true, 'Anglais, français', array['study','work','settle']::text[], '["Études", "Travail qualifié", "Résidence permanente"]', '["Study", "Skilled work", "Permanent residence"]', 'Destination majeure pour les études, le travail qualifié et l''immigration permanente.', 'A leading destination for study, skilled work and permanent immigration.', '[{"label": "Immigration, Réfugiés et Citoyenneté Canada", "url": "https://www.canada.ca/fr/services/immigration-citoyennete.html"}]', 'Immigration, Réfugiés et Citoyenneté Canada', 'https://www.canada.ca/fr/services/immigration-citoyennete.html', null),
  ('united-states', 'US', 'États-Unis', 'United States', 'north_america', -74, 40.7, true, 'Anglais', array['study','work']::text[], '["Études", "Programmes d''échange"]', '["Study", "Exchange programmes"]', 'Large choix d''universités et de programmes d''échange.', 'A wide choice of universities and exchange programmes.', '[{"label": "U.S. Department of State — Visas", "url": "https://travel.state.gov/content/travel/en/us-visas.html"}]', 'U.S. Department of State — Visas', 'https://travel.state.gov/content/travel/en/us-visas.html', 'USA'),
  ('france', 'FR', 'France', 'France', 'europe', 2.35, 48.85, true, 'Français', array['study','work','settle']::text[], '["Études supérieures", "Stages", "Travail"]', '["Higher education", "Internships", "Work"]', 'Destination francophone de référence pour les études supérieures et la mobilité professionnelle.', 'A key French-speaking destination for higher education and professional mobility.', '[{"label": "France-Visas", "url": "https://france-visas.gouv.fr"}, {"label": "Campus France", "url": "https://www.campusfrance.org"}]', 'France-Visas', 'https://france-visas.gouv.fr', null),
  ('belgium', 'BE', 'Belgique', 'Belgium', 'europe', 4.35, 50.85, true, 'Français, néerlandais', array['study','work']::text[], '["Universités francophones", "Recherche"]', '["French-speaking universities", "Research"]', 'Pays multilingue au cœur de l''Europe, apprécié pour ses universités francophones.', 'A multilingual country at the heart of Europe, popular for its French-speaking universities.', '[{"label": "Office des Étrangers", "url": "https://dofi.ibz.be"}]', 'Office des Étrangers', 'https://dofi.ibz.be', null),
  ('germany', 'DE', 'Allemagne', 'Germany', 'europe', 13.4, 52.5, true, 'Allemand', array['study','work','settle']::text[], '["Ausbildung", "Travail qualifié", "Études"]', '["Ausbildung", "Skilled work", "Study"]', 'Forte demande de main-d''œuvre qualifiée, formations Ausbildung et universités publiques.', 'Strong demand for skilled workers, Ausbildung training and public universities.', '[{"label": "Make it in Germany", "url": "https://www.make-it-in-germany.com"}, {"label": "Auswärtiges Amt", "url": "https://www.auswaertiges-amt.de"}]', 'Make it in Germany', 'https://www.make-it-in-germany.com', null),
  ('united-kingdom', 'GB', 'Royaume-Uni', 'United Kingdom', 'europe', -0.13, 51.5, true, 'Anglais', array['study','work']::text[], '["Études", "Travail qualifié"]', '["Study", "Skilled work"]', 'Universités de renommée mondiale et parcours de visas à points.', 'World-renowned universities and points-based visa routes.', '[{"label": "GOV.UK — Visas and immigration", "url": "https://www.gov.uk/browse/visas-immigration"}]', 'GOV.UK — Visas and immigration', 'https://www.gov.uk/browse/visas-immigration', 'UK Angleterre England Londres London'),
  ('switzerland', 'CH', 'Suisse', 'Switzerland', 'europe', 7.45, 46.95, false, 'Français, allemand, italien', array['study','work']::text[], '["Hautes écoles", "Hôtellerie", "Recherche"]', '["Universities", "Hospitality", "Research"]', 'Écoles réputées, notamment en hôtellerie et en ingénierie, dans un environnement multilingue.', 'Renowned schools, especially in hospitality and engineering, in a multilingual setting.', '[{"label": "Secrétariat d''État aux migrations", "url": "https://www.sem.admin.ch"}]', 'Secrétariat d''État aux migrations', 'https://www.sem.admin.ch', null),
  ('luxembourg', 'LU', 'Luxembourg', 'Luxembourg', 'europe', 6.13, 49.61, false, 'Français, allemand, luxembourgeois', array['work','study']::text[], '["Finance", "Travail qualifié"]', '["Finance", "Skilled work"]', 'Petit pays au marché du travail international, centré sur la finance et les services.', 'A small country with an international job market focused on finance and services.', '[{"label": "Guichet.lu", "url": "https://guichet.public.lu"}]', 'Guichet.lu', 'https://guichet.public.lu', null),
  ('netherlands', 'NL', 'Pays-Bas', 'Netherlands', 'europe', 4.9, 52.37, false, 'Néerlandais, anglais', array['study','work']::text[], '["Programmes en anglais", "Travail qualifié"]', '["English-taught programmes", "Skilled work"]', 'Nombreux programmes universitaires enseignés en anglais et économie très internationale.', 'Many English-taught university programmes and a highly international economy.', '[{"label": "IND — Immigration and Naturalisation Service", "url": "https://ind.nl"}]', 'IND — Immigration and Naturalisation Service', 'https://ind.nl', 'Hollande Holland'),
  ('ireland', 'IE', 'Irlande', 'Ireland', 'europe', -6.26, 53.35, false, 'Anglais', array['study','work']::text[], '["Études", "Technologies"]', '["Study", "Technology"]', 'Pays anglophone de l''Union européenne, avec un secteur technologique dynamique.', 'An English-speaking EU country with a dynamic tech sector.', '[{"label": "Irish Immigration Service", "url": "https://www.irishimmigration.ie"}]', 'Irish Immigration Service', 'https://www.irishimmigration.ie', null),
  ('spain', 'ES', 'Espagne', 'Spain', 'europe', -3.7, 40.42, false, 'Espagnol', array['study','work']::text[], '["Études", "Tourisme et hôtellerie"]', '["Study", "Tourism and hospitality"]', 'Coût de la vie modéré et offre universitaire variée.', 'Moderate cost of living and a varied university offer.', '[{"label": "Ministère des Affaires étrangères", "url": "https://www.exteriores.gob.es"}]', 'Ministère des Affaires étrangères', 'https://www.exteriores.gob.es', null),
  ('portugal', 'PT', 'Portugal', 'Portugal', 'europe', -9.14, 38.72, false, 'Portugais', array['study','work','settle']::text[], '["Études", "Travail", "Installation"]', '["Study", "Work", "Relocation"]', 'Destination appréciée pour sa qualité de vie et son coût de la vie accessible.', 'Valued for its quality of life and affordable cost of living.', '[{"label": "Portail des visas", "url": "https://vistos.mne.gov.pt"}]', 'Portail des visas', 'https://vistos.mne.gov.pt', null),
  ('italy', 'IT', 'Italie', 'Italy', 'europe', 9.19, 45.46, false, 'Italien', array['study']::text[], '["Études en anglais", "Bourses régionales"]', '["English-taught study", "Regional scholarships"]', 'Programmes universitaires en anglais et frais de scolarité souvent accessibles.', 'English-taught university programmes and often affordable tuition.', '[{"label": "Visto per l''Italia", "url": "https://vistoperitalia.esteri.it"}]', 'Visto per l''Italia', 'https://vistoperitalia.esteri.it', null),
  ('romania', 'RO', 'Roumanie', 'Romania', 'europe', 26.1, 44.43, false, 'Roumain', array['study']::text[], '["Études de médecine", "Année préparatoire"]', '["Medical studies", "Foundation year"]', 'Études médicales et techniques, avec une année préparatoire de langue roumaine.', 'Medical and technical studies, with a preparatory Romanian language year.', '[{"label": "MAE Roumanie — eVisa", "url": "https://evisa.mae.ro"}]', 'MAE Roumanie — eVisa', 'https://evisa.mae.ro', null),
  ('poland', 'PL', 'Pologne', 'Poland', 'europe', 21.01, 52.23, false, 'Polonais', array['study','work']::text[], '["Études", "Industrie"]', '["Study", "Industry"]', 'Universités aux frais modérés et économie en croissance.', 'Universities with moderate fees and a growing economy.', '[{"label": "Gouvernement polonais — diplomatie", "url": "https://www.gov.pl/web/diplomacy"}]', 'Gouvernement polonais — diplomatie', 'https://www.gov.pl/web/diplomacy', null),
  ('latvia', 'LV', 'Lettonie', 'Latvia', 'europe', 24.1, 56.95, false, 'Letton', array['study']::text[], '["Études en anglais"]', '["English-taught study"]', 'Pays balte proposant des formations en anglais à des coûts accessibles.', 'A Baltic country offering English-taught programmes at affordable cost.', '[{"label": "Office de la citoyenneté et des migrations", "url": "https://www.pmlp.gov.lv"}]', 'Office de la citoyenneté et des migrations', 'https://www.pmlp.gov.lv', null),
  ('albania', 'AL', 'Albanie', 'Albania', 'europe', 19.82, 41.33, false, 'Albanais', array['study','work']::text[], '["Études", "Travail saisonnier", "Tourisme et hôtellerie"]', '["Study", "Seasonal work", "Tourism and hospitality"]', 'Pays des Balkans au coût de la vie modéré, avec un secteur touristique en forte croissance.', 'A Balkan country with a moderate cost of living and a fast-growing tourism sector.', '[{"label": "e-Albania — portail officiel", "url": "https://e-albania.al"}]', 'e-Albania — portail officiel', 'https://e-albania.al', null),
  ('serbia', 'RS', 'Serbie', 'Serbia', 'europe', 20.46, 44.79, false, 'Serbe', array['study','work']::text[], '["Études", "Travail", "Industrie"]', '["Study", "Work", "Industry"]', 'Carrefour des Balkans, avec des universités publiques accessibles et une économie en développement.', 'A Balkan crossroads with accessible public universities and a developing economy.', '[{"label": "Ministère des Affaires étrangères de Serbie", "url": "https://www.mfa.gov.rs"}]', 'Ministère des Affaires étrangères de Serbie', 'https://www.mfa.gov.rs', null),
  ('turkey', 'TR', 'Turquie', 'Türkiye', 'europe', 28.98, 41.01, false, 'Turc', array['study']::text[], '["Études", "Bourses"]', '["Study", "Scholarships"]', 'Carrefour entre l''Europe et l''Asie, avec de nombreuses universités publiques et privées.', 'A crossroads between Europe and Asia with many public and private universities.', '[{"label": "e-Visa République de Turquie", "url": "https://www.evisa.gov.tr"}]', 'e-Visa République de Turquie', 'https://www.evisa.gov.tr', 'Turkey Istanbul'),
  ('morocco', 'MA', 'Maroc', 'Morocco', 'africa', -6.85, 34.02, false, 'Arabe, français', array['study','work']::text[], '["Études francophones", "Écoles d''ingénieurs"]', '["French-taught study", "Engineering schools"]', 'Destination francophone proche, appréciée pour ses écoles d''ingénieurs et de commerce.', 'A nearby French-speaking destination known for its engineering and business schools.', '[]', null, null, null),
  ('ivory-coast', 'CI', 'Côte d''Ivoire', 'Côte d''Ivoire', 'africa', -4.03, 5.36, false, 'Français', array['work','study']::text[], '["Travail", "Grandes écoles"]', '["Work", "Graduate schools"]', 'Pôle économique d''Afrique de l''Ouest, avec un marché du travail francophone.', 'West Africa''s economic hub with a French-speaking job market.', '[]', null, null, 'Abidjan Ivory Coast'),
  ('south-africa', 'ZA', 'Afrique du Sud', 'South Africa', 'africa', 28.04, -26.2, false, 'Anglais', array['study','work']::text[], '["Universités", "Travail qualifié"]', '["Universities", "Skilled work"]', 'Universités reconnues sur le continent et économie diversifiée.', 'Well-regarded universities and a diversified economy.', '[{"label": "Department of Home Affairs", "url": "https://www.dha.gov.za"}]', 'Department of Home Affairs', 'https://www.dha.gov.za', null),
  ('cameroon', 'CM', 'Cameroun', 'Cameroon', 'africa', 9.7, 4.05, false, 'Français, anglais', array[]::text[], '["Point de départ"]', '["Starting point"]', 'Point de départ de nombreux projets de mobilité accompagnés par la plateforme.', 'The starting point of many mobility projects supported by the platform.', '[]', null, null, null),
  ('uae', 'AE', 'Dubaï (Émirats arabes unis)', 'Dubai (United Arab Emirates)', 'middle_east', 55.27, 25.2, false, 'Arabe, anglais', array['work','settle']::text[], '["Travail", "Hôtellerie", "Commerce", "Entrepreneuriat"]', '["Work", "Hospitality", "Trade", "Entrepreneurship"]', 'Dubaï est un hub international pour le commerce, l''hôtellerie, l''aviation et les services.', 'Dubai is an international hub for trade, hospitality, aviation and services.', '[{"label": "Portail officiel des Émirats", "url": "https://u.ae"}]', 'Portail officiel des Émirats', 'https://u.ae', 'Dubai UAE EAU Abu Dhabi'),
  ('china', 'CN', 'Chine', 'China', 'asia', 116.4, 39.9, false, 'Mandarin', array['study']::text[], '["Études", "Bourses"]', '["Study", "Scholarships"]', 'Nombreuses bourses d''études et universités ouvertes aux étudiants internationaux.', 'Many scholarships and universities open to international students.', '[{"label": "Visa for China", "url": "https://www.visaforchina.cn"}]', 'Visa for China', 'https://www.visaforchina.cn', null),
  ('japan', 'JP', 'Japon', 'Japan', 'asia', 139.69, 35.68, false, 'Japonais', array['study','work']::text[], '["Études", "Recherche", "Technologies"]', '["Study", "Research", "Technology"]', 'Excellence technologique et programmes universitaires de recherche.', 'Technological excellence and research-driven university programmes.', '[{"label": "Ministère des Affaires étrangères du Japon", "url": "https://www.mofa.go.jp/j_info/visit/visa/"}]', 'Ministère des Affaires étrangères du Japon', 'https://www.mofa.go.jp/j_info/visit/visa/', null),
  ('south-korea', 'KR', 'Corée du Sud', 'South Korea', 'asia', 126.98, 37.57, false, 'Coréen', array['study']::text[], '["Études", "Bourses gouvernementales"]', '["Study", "Government scholarships"]', 'Universités reconnues et programmes de bourses pour étudiants étrangers.', 'Recognised universities and scholarship programmes for foreign students.', '[{"label": "Korea Visa Portal", "url": "https://www.visa.go.kr"}, {"label": "Study in Korea", "url": "https://www.studyinkorea.go.kr"}]', 'Korea Visa Portal', 'https://www.visa.go.kr', 'Korea Seoul'),
  ('australia', 'AU', 'Australie', 'Australia', 'oceania', 151.21, -33.87, false, 'Anglais', array['study','work','settle']::text[], '["Études", "Travail qualifié", "Résidence permanente"]', '["Study", "Skilled work", "Permanent residence"]', 'Grande destination anglophone pour les études et l''immigration qualifiée.', 'A major English-speaking destination for study and skilled immigration.', '[{"label": "Department of Home Affairs", "url": "https://immi.homeaffairs.gov.au"}]', 'Department of Home Affairs', 'https://immi.homeaffairs.gov.au', null),
  ('new-zealand', 'NZ', 'Nouvelle-Zélande', 'New Zealand', 'oceania', 174.76, -36.85, false, 'Anglais', array['study','work']::text[], '["Études", "Travail"]', '["Study", "Work"]', 'Cadre de vie recherché et formations reconnues.', 'A sought-after lifestyle and recognised training.', '[{"label": "Immigration New Zealand", "url": "https://www.immigration.govt.nz"}]', 'Immigration New Zealand', 'https://www.immigration.govt.nz', null),
  ('brazil', 'BR', 'Brésil', 'Brazil', 'latin_america', -46.63, -23.55, false, 'Portugais', array['study','work']::text[], '["Études", "Échanges"]', '["Study", "Exchanges"]', 'Première économie d''Amérique latine, avec des programmes d''échange universitaires.', 'Latin America''s largest economy, with university exchange programmes.', '[{"label": "Ministère des Relations extérieures", "url": "https://www.gov.br/mre"}]', 'Ministère des Relations extérieures', 'https://www.gov.br/mre', null)
) as v(slug, iso2, name_fr, name_en, region, lon, lat, is_popular, main_languages, goals, opportunities_fr, opportunities_en, overview_fr, overview_en, official_links, source_name, source_url, aliases)
on conflict (slug) do update set iso2 = excluded.iso2, name_fr = excluded.name_fr, name_en = excluded.name_en, region = excluded.region, lon = excluded.lon, lat = excluded.lat,
  is_popular = excluded.is_popular, main_languages = excluded.main_languages, goals = excluded.goals, opportunities_fr = excluded.opportunities_fr, opportunities_en = excluded.opportunities_en,
  overview_fr = excluded.overview_fr, overview_en = excluded.overview_en, official_links = excluded.official_links, source_name = excluded.source_name, source_url = excluded.source_url, aliases = excluded.aliases;

-- ─── Demo users ────────────────────────────────────────────────────
do $$
declare
  u record;
  v_id uuid;
begin
  for u in select * from (values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@monprojet.dev', 'Administrateur', 'client'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'client@monprojet.dev', 'Client Démo', 'client'),
    ('00000000-0000-4000-a000-000000000011'::uuid, 'amina.consultant@monprojet.dev', 'Amina Ndoumbe', 'consultant'),
    ('00000000-0000-4000-a000-000000000012'::uuid, 'lukas.consultant@monprojet.dev', 'Lukas Bauer', 'consultant'),
    ('00000000-0000-4000-a000-000000000013'::uuid, 'claire.consultant@monprojet.dev', 'Claire Fotso', 'consultant'),
    ('00000000-0000-4000-a000-000000000014'::uuid, 'david.consultant@monprojet.dev', 'David Mensah', 'consultant'),
    ('00000000-0000-4000-a000-000000000015'::uuid, 'sofia.consultant@monprojet.dev', 'Sofia Rinaldi', 'consultant'),
    ('00000000-0000-4000-a000-000000000016'::uuid, 'paul.consultant@monprojet.dev', 'Paul Ekambi', 'consultant')
  ) as t(id, email, name, account_type) loop
    if not exists (select 1 from auth.users where id = u.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
        extensions.crypt('Demo#2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', u.name, 'account_type', u.account_type), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now());
    end if;
  end loop;
  insert into public.user_roles (user_id, role_id)
  select '00000000-0000-4000-a000-000000000001', id from public.roles where key in ('admin', 'editor')
  on conflict do nothing;
end $$;

-- ─── Demo consultants ──────────────────────────────────────────────
insert into public.consultants (id, user_id, slug, professional_name, title_fr, title_en, short_bio_fr, short_bio_en, bio_fr,
  consultant_type, verification_status, verified_at, years_experience, methods, city, is_published, license_authority) values
  ('10000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000011', 'amina-ndoumbe', 'Amina Ndoumbe',
   'Consultante réglementée en immigration canadienne', 'Regulated Canadian Immigration Consultant',
   'Accompagne étudiants et travailleurs qualifiés vers le Canada depuis 9 ans.',
   'Helping students and skilled workers move to Canada for 9 years.',
   'Amina accompagne les candidats d''Afrique centrale dans leurs projets d''études et d''immigration au Canada.',
   'authorized_legal_representative', 'verified', now(), 9, array['video', 'phone']::public.consultation_method[], 'Douala', true, 'CICC (démo)'),
  ('10000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000012', 'lukas-bauer', 'Lukas Bauer',
   'Spécialiste Ausbildung & emploi en Allemagne', 'Ausbildung & Germany jobs specialist',
   'Expert des parcours Ausbildung et de la reconnaissance des diplômes en Allemagne.',
   'Expert in Ausbildung pathways and degree recognition in Germany.',
   'Lukas guide les candidats francophones à travers les étapes de l''Ausbildung et de l''emploi qualifié.',
   'immigration_consultant', 'verified', now(), 7, array['video']::public.consultation_method[], 'Berlin', true, null),
  ('10000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000013', 'claire-fotso', 'Claire Fotso',
   'Conseillère en orientation — études en France et Belgique', 'Study advisor — France & Belgium',
   'Orientation universitaire, Campus France et préparation des entretiens.',
   'University guidance, Campus France and interview preparation.',
   'Claire aide les étudiants à construire un projet d''études cohérent et un dossier solide.',
   'orientation_specialist', 'verified', now(), 6, array['video', 'phone', 'in_person']::public.consultation_method[], 'Yaoundé', true, null),
  ('10000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000014', 'david-mensah', 'David Mensah',
   'Avocat — droit de l''immigration (Royaume-Uni)', 'Immigration lawyer (UK)',
   'Représentation et conseil juridique pour les visas de travail et familiaux.',
   'Legal advice and representation for work and family visas.',
   'David conseille particuliers et entreprises sur les visas britanniques.',
   'authorized_legal_representative', 'pending', null, 12, array['video']::public.consultation_method[], 'London', true, 'SRA (en cours de vérification)'),
  ('10000000-0000-4000-a000-000000000015', '00000000-0000-4000-a000-000000000015', 'sofia-rinaldi', 'Sofia Rinaldi',
   'Conseillère études en Italie et Roumanie', 'Study advisor — Italy & Romania',
   'Admissions universitaires en anglais, bourses régionales et logement étudiant.',
   'English-taught admissions, regional scholarships and student housing.',
   'Sofia accompagne les étudiants dans le choix de l''université et la préparation du dossier.',
   'orientation_specialist', 'verified', now(), 5, array['video', 'chat']::public.consultation_method[], 'Milano', true, null),
  ('10000000-0000-4000-a000-000000000016', '00000000-0000-4000-a000-000000000016', 'paul-ekambi', 'Paul Ekambi',
   'Consultant mobilité internationale', 'International mobility consultant',
   'Premier diagnostic de projet et orientation vers les bonnes procédures.',
   'Initial project diagnosis and guidance towards the right procedures.',
   'Paul réalise des diagnostics complets de profil pour orienter les candidats.',
   'immigration_consultant', 'unverified', null, 3, array['phone', 'in_person']::public.consultation_method[], 'Douala', true, null)
on conflict (id) do nothing;

insert into public.consultant_countries (consultant_id, country_id)
select c.id, co.id from (values
  ('amina-ndoumbe', 'canada'), ('lukas-bauer', 'germany'), ('claire-fotso', 'france'), ('claire-fotso', 'belgium'),
  ('david-mensah', 'united-kingdom'), ('sofia-rinaldi', 'italy'), ('sofia-rinaldi', 'romania'),
  ('paul-ekambi', 'canada'), ('paul-ekambi', 'france'), ('paul-ekambi', 'germany')
) v(cslug, coslug) join public.consultants c on c.slug = v.cslug join public.countries co on co.slug = v.coslug
on conflict do nothing;

insert into public.consultant_specialties (consultant_id, specialty_id)
select c.id, s.id from (values
  ('amina-ndoumbe', 'study-visa'), ('amina-ndoumbe', 'permanent-residence'), ('amina-ndoumbe', 'work-permit'),
  ('lukas-bauer', 'ausbildung'), ('lukas-bauer', 'work-permit'),
  ('claire-fotso', 'university-admission'), ('claire-fotso', 'study-visa'),
  ('david-mensah', 'work-permit'), ('david-mensah', 'family-reunification'),
  ('sofia-rinaldi', 'university-admission'), ('sofia-rinaldi', 'study-visa'),
  ('paul-ekambi', 'career-orientation'), ('paul-ekambi', 'document-review')
) v(cslug, sslug) join public.consultants c on c.slug = v.cslug join public.specialties s on s.slug = v.sslug
on conflict do nothing;

insert into public.consultant_languages (consultant_id, language_code, proficiency)
select c.id, v.lang, v.prof from (values
  ('amina-ndoumbe', 'fr', 'native'), ('amina-ndoumbe', 'en', 'fluent'),
  ('lukas-bauer', 'de', 'native'), ('lukas-bauer', 'fr', 'fluent'), ('lukas-bauer', 'en', 'fluent'),
  ('claire-fotso', 'fr', 'native'), ('claire-fotso', 'en', 'professional'),
  ('david-mensah', 'en', 'native'), ('david-mensah', 'fr', 'professional'),
  ('sofia-rinaldi', 'it', 'native'), ('sofia-rinaldi', 'en', 'fluent'), ('sofia-rinaldi', 'fr', 'professional'), ('sofia-rinaldi', 'ro', 'professional'),
  ('paul-ekambi', 'fr', 'native'), ('paul-ekambi', 'en', 'fluent')
) v(cslug, lang, prof) join public.consultants c on c.slug = v.cslug
on conflict do nothing;

insert into public.consultant_qualifications (consultant_id, title, institution, level, year_obtained, is_verified)
select c.id, v.title, v.inst, v.lvl, v.yr, v.ver from (values
  ('amina-ndoumbe', 'Diplôme en consultation en immigration', 'Université (démo)', 'certificate', 2016, true),
  ('amina-ndoumbe', 'Master en droit international', 'Université de Douala (démo)', 'master', 2014, true),
  ('lukas-bauer', 'Master Personalmanagement', 'Universität (démo)', 'master', 2017, true),
  ('claire-fotso', 'Master Sciences de l''éducation', 'Université de Yaoundé I (démo)', 'master', 2018, true),
  ('david-mensah', 'LLM Immigration Law', 'University (démo)', 'master', 2012, false),
  ('sofia-rinaldi', 'Laurea magistrale in Relazioni internazionali', 'Università (démo)', 'master', 2019, true),
  ('paul-ekambi', 'Licence en gestion', 'Université (démo)', 'bachelor', 2020, false)
) v(cslug, title, inst, lvl, yr, ver) join public.consultants c on c.slug = v.cslug;

-- Services offered by each consultant (null price → service base price)
insert into public.consultant_services (consultant_id, service_id, price, currency, duration_minutes, methods)
select c.id, s.id, v.price, 'XAF', v.dur, c.methods
from (values
  ('amina-ndoumbe', 'consultation', null::numeric, 45), ('amina-ndoumbe', 'profile-assessment', null, 60),
  ('lukas-bauer', 'consultation', null, 45), ('lukas-bauer', 'profile-assessment', null, 60),
  ('claire-fotso', 'consultation', null, 30), ('claire-fotso', 'consultation', 20000, 60), ('claire-fotso', 'profile-assessment', null, 60),
  ('david-mensah', 'consultation', 25000, 45),
  ('sofia-rinaldi', 'consultation', null, 45), ('sofia-rinaldi', 'profile-assessment', null, 60),
  ('paul-ekambi', 'consultation', null, 45), ('paul-ekambi', 'profile-assessment', null, 60)
) v(cslug, sslug, price, dur)
join public.consultants c on c.slug = v.cslug join public.services s on s.slug = v.sslug
on conflict do nothing;

-- Weekday availability 09:00–17:00 (Mon–Fri) + Saturday morning for some
insert into public.availability (consultant_id, weekday, start_time, end_time)
select c.id, d, '09:00', '17:00' from public.consultants c cross join generate_series(1, 5) d
where not exists (select 1 from public.availability a where a.consultant_id = c.id);
insert into public.availability (consultant_id, weekday, start_time, end_time)
select c.id, 6, '09:00', '12:00' from public.consultants c where c.slug in ('claire-fotso', 'paul-ekambi');

-- ─── Demo articles (generic guidance only — no invented requirements) ──
insert into public.articles (slug, locale, title, description, body, category_id, country_id, procedure_type, author_id,
  reliability, status, published_at, last_verified_at, review_due_at)
select v.slug, 'fr', v.title, v.descr, v.body, cat.id, co.id, v.proc, '00000000-0000-4000-a000-000000000001',
  'editorial', 'published', now(), current_date, current_date + 180
from (values
  ('verifier-information-officielle', 'Comment vérifier qu''une information sur les visas est officielle',
   'Les bons réflexes pour distinguer une source officielle d''une rumeur ou d''une arnaque.',
   E'## Pourquoi c''est important\n\nLes conditions de visa changent régulièrement. Une information obsolète peut entraîner un refus.\n\n## Les bons réflexes\n\n- Consultez **toujours** le site officiel du pays de destination ou de son ambassade.\n- Vérifiez la date de mise à jour de la page.\n- Méfiez-vous des promesses de « visa garanti ».\n- Ne payez jamais de frais officiels à un intermédiaire non autorisé.\n\n## Et GLOBENTIA ?\n\nChaque fiche pays et chaque article affichent leur source et leur date de dernière vérification.',
   'country-guides', null, 'general'),
  ('preparer-sa-consultation', 'Préparer sa première consultation avec un expert',
   'Les documents et questions à préparer pour tirer le meilleur parti de votre rendez-vous.',
   E'## Avant le rendez-vous\n\n1. Résumez votre projet en quelques lignes (pays, objectif, calendrier).\n2. Rassemblez vos diplômes, relevés de notes et expériences.\n3. Notez vos questions prioritaires.\n\n## Pendant le rendez-vous\n\nPrenez des notes et demandez quelles sources officielles consulter.\n\n## Après\n\nVotre expert peut vous proposer une évaluation de profil ou une assistance procédurale sur devis.',
   'immigration', null, 'consultation'),
  ('etudier-en-allemagne-ausbildung-premiers-pas', 'Ausbildung en Allemagne : par où commencer ?',
   'Comprendre le principe de la formation en alternance allemande avant de vous lancer.',
   E'## Le principe\n\nL''Ausbildung combine formation en entreprise et cours en école professionnelle.\n\n## Par où commencer\n\n- Consultez le portail officiel *Make it in Germany*.\n- Évaluez votre niveau d''allemand.\n- Échangez avec un spécialiste pour valider votre projet.\n\n> Les conditions de visa doivent être vérifiées sur les sites officiels allemands avant toute démarche.',
   'work-abroad', 'germany', 'ausbildung')
) v(slug, title, descr, body, catslug, coslug, proc)
join public.categories cat on cat.slug = v.catslug
left join public.countries co on co.slug = v.coslug
on conflict (slug) do nothing;

insert into public.article_sources (article_id, label, url, is_official)
select a.id, 'Make it in Germany', 'https://www.make-it-in-germany.com', true
from public.articles a where a.slug = 'etudier-en-allemagne-ausbildung-premiers-pas'
  and not exists (select 1 from public.article_sources s where s.article_id = a.id);

-- ─── Certifications de démonstration (organismes fictifs ou marqués « démo ») ──
insert into public.consultant_certifications (consultant_id, title, issuer, year_obtained, is_verified)
select c.id, v.title, v.issuer, v.yr, v.ok from (values
  ('amina-ndoumbe', 'Licence de consultante réglementée en immigration', 'CICC (démo)', 2017, true),
  ('amina-ndoumbe', 'Formation continue obligatoire 2026', 'CICC (démo)', 2026, true),
  ('lukas-bauer', 'Conseiller certifié en formation professionnelle', 'IHK (démo)', 2019, true),
  ('lukas-bauer', 'Goethe-Zertifikat C2', 'Goethe-Institut (démo)', 2015, true),
  ('claire-fotso', 'Certification conseillère en orientation', 'Organisme certificateur (démo)', 2020, true),
  ('david-mensah', 'Solicitor — inscription au tableau', 'SRA (en cours de vérification)', 2013, false),
  ('sofia-rinaldi', 'Certificat en conseil aux études internationales', 'Organisme certificateur (démo)', 2021, true),
  ('sofia-rinaldi', 'IELTS Academic 8.0', 'British Council (démo)', 2018, true)
) v(cslug, title, issuer, yr, ok) join public.consultants c on c.slug = v.cslug
where not exists (select 1 from public.consultant_certifications x where x.consultant_id = c.id);
