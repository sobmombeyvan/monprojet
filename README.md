# MonProjet — marketplace de mobilité internationale

Information fiable, orientation et consultants vérifiés pour les projets d'études, de travail et d'installation à l'étranger.

**Stack** : Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · next-intl (FR/EN) · paiements Mobile Money via Fapshi (+ mode sandbox de test).

> Le nom du site se change en **une ligne** : `NEXT_PUBLIC_SITE_NAME` dans `.env.local` (ou `src/config/site.ts`). Il est repris partout : en-tête, pied de page, e-mails, métadonnées, textes FR/EN (`{{brand}}` dans `messages/*.json`).

- 📋 **Mise en production pas à pas : [PRODUCTION.md](./PRODUCTION.md)**
- 🧭 Architecture et avancement : [PLAN.md](./PLAN.md)

---

## 1. Démarrer dans VS Code

Prérequis : **Node.js 20+**, **Docker Desktop** (pour Supabase en local), **Supabase CLI** (`npm i -g supabase` ou `brew install supabase/tap/supabase`).

```bash
npm install
cp .env.example .env.local
supabase start            # Postgres + Auth + Storage en local (Docker)
supabase db reset         # migrations + données de démonstration
npm run db:types          # types TypeScript générés depuis la base
npm run dev               # http://localhost:3000
```

Copiez dans `.env.local` les valeurs affichées par `supabase start` : `API URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`.

Ouvrez le dossier dans VS Code : les extensions recommandées (Tailwind, ESLint, Prettier, Supabase, i18n Ally) sont proposées automatiquement (`.vscode/extensions.json`).

> **PC peu puissant ?** Docker + Supabase local consomment beaucoup de mémoire. Alternative : créez un projet gratuit sur [supabase.com](https://supabase.com), puis `supabase link --project-ref <ref>` et `supabase db push`, et mettez ses clés dans `.env.local` (voir PRODUCTION.md §2).

**Comptes de démonstration** (mot de passe `Demo#2026`, base locale uniquement) :

| E-mail | Rôle |
|---|---|
| `admin@monprojet.dev` | administrateur + éditeur |
| `client@monprojet.dev` | client |
| `amina.consultant@monprojet.dev` (et lukas, claire, david, sofia, paul) | consultants |

### Première vérification à faire

Ce code a été écrit dans un environnement **sans accès à npm** : la base de données et la logique de paiement ont été **testées réellement**, la syntaxe de tous les fichiers est vérifiée, mais `next build` n'a jamais tourné. Lancez en premier :

```bash
npm run db:types     # remplace le type provisoire `Database = any`
npm run typecheck
npm run build
```

et corrigez les éventuels écarts de types signalés (ils sont attendus en petit nombre : noms de colonnes, imports).

## 2. Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | développement / build / production |
| `npm run check` | typecheck + lint + tests unitaires |
| `npm test` | tests unitaires (signatures, webhooks idempotents, anti-XSS) |
| `npm run test:db` | 18 scénarios SQL sur un Postgres local (RLS, double réservation, paiements…) |
| `npm run db:types` / `db:types:remote` | types depuis la base locale / le projet lié |
| `npm run db:push` | applique les migrations sur le projet Supabase lié |

## 3. Base de données

```
supabase/migrations/
  …01_core_schema.sql                    tables, contraintes (anti-chevauchement, sources obligatoires)
  …02_functions.sql                      rôles, gardes, audit, créneaux, holds, confirm_payment, recherche
  …03_rls.sql                            Row Level Security sur toutes les tables
  …04_storage.sql                        buckets et règles Storage
  …05_v2_destinations_certifications.sql 30 pays enrichis, certifications, tri, édition admin
supabase/reference-data.sql              données de référence — À EXÉCUTER AUSSI EN PRODUCTION
supabase/seed.sql                        référence + comptes et consultants de démo (DEV UNIQUEMENT)
```

Tests SQL : `PGHOST=localhost PGUSER=postgres npm run test:db` (le script émule `auth` et `storage` de Supabase).

## 4. Paiements

```
navigateur ──(id réservation)──▶ startCheckout()        montant lu en base, jamais envoyé par le navigateur
prestataire ──POST signé──▶ /api/webhooks/payments/:provider
   1. signature vérifiée sur le corps brut (anti-rejeu 5 min)
   2. INSERT payment_webhooks (provider, event_id) UNIQUE  → idempotence
   3. confirm_payment() (service role) : montant comparé, réservation confirmée, commission, notifications
navigateur ──poll──▶ /booking/confirmation              statut lu en base, jamais dans l'URL
```

- **Sandbox** (par défaut, refusée si `APP_ENV=production`) : `/booking/sandbox-checkout` envoie un vrai webhook signé.
- **Fapshi** (FCFA, MTN Mobile Money / Orange Money) : configuration détaillée dans PRODUCTION.md §4.
- **Ajouter un prestataire** (NotchPay, Flutterwave…) : implémenter `PaymentProvider` (`src/lib/payments/types.ts`) et l'enregistrer dans `src/lib/payments/index.ts`.

## 5. Fonctionnalités

- Accueil : globe interactif (destinations, connexions depuis Douala), recherche à 3 filtres, parcours « solutions adaptées à mon profil ».
- Trouver un expert : filtres, tri (pertinence, prix, note, expérience — jamais la commission), comparateur jusqu'à 3 experts.
- Destinations : 29 pays + carte animée, filtres par objectif et région, liens officiels.
- Réservation en 3 étapes avec blocage du créneau pendant le paiement, annulation selon politique.
- Espaces client, consultant (profil, documents privés, disponibilités, services, revenus, avis) et administration (vérifications, **édition complète des consultants**, rôles, paiements, commissions, statistiques, export CSV, paramètres, journal d'audit).
- FR / EN, responsive mobile (iPhone : pas de zoom sur les champs, zones sûres).

## 6. Structure

```
src/
  config/site.ts         nom, slogan, contact, ville de départ
  app/[locale]/          pages publiques, auth, réservation, espaces client/consultant/admin
  app/api/               webhooks, cron, créneaux, export
  components/            ui/, layout/, home/, globe/, experts/, countries/, solutions/, booking/, dashboard/, admin/
  lib/                   payments/, actions/, booking/, data/, supabase/, validation/, geo.ts
messages/fr.json en.json
supabase/                migrations, reference-data.sql, seed.sql, tests/
tests/                   tests unitaires (node:test)
```
