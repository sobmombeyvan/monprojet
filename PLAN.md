# GLOBENTIA — Plan d'implémentation

> Your Journey. Expertly Guided. · Information. Expertise. Opportunities.

## Principes d'architecture

| Décision | Raison |
|---|---|
| **La base de données est l'autorité** pour tout ce qui est critique (créneaux, paiements, commissions, droits) | Les règles ne peuvent pas être contournées par un client modifié ou un bug d'interface |
| Réservations via fonctions SQL `security definer` + contrainte d'exclusion `EXCLUDE USING gist` | Double réservation **impossible**, même sous forte concurrence |
| Paiement = **port** (`PaymentProvider`) + registre | Ajouter Flutterwave/NotchPay = 1 fichier, aucune modification du booking |
| Webhook = pipeline unique `vérifier → stocker (clé d'idempotence) → appliquer → marquer` | Même chemin pour sandbox et Fapshi ; rejouable sans effet de bord |
| Montant **toujours lu en base**, jamais envoyé par le navigateur ; revérifié dans `confirm_payment()` | Protection contre la falsification du prix |
| RLS sur 100 % des tables ; client service-role isolé derrière `server-only` | Fuite de clé impossible côté bundle client |
| i18n `next-intl` (FR par défaut sans préfixe, EN sous `/en`) ; contenu BDD bilingue `_fr` / `_en` | Traduction prévue dès le départ |
| Formulaires de filtres en `GET` natif | Fonctionne sans JS, URLs partageables, SEO |
| Classement des experts : pertinence + vérification + qualifications + expérience + avis — **la commission n'est pas une entrée** | Exigence §6 |
| Le type « représentant légal / professionnel agréé » n'est affiché **qu'après vérification** | Exigence §7 |
| Les fiches visa ne peuvent être publiées **sans URL officielle ni date de vérification** (contrainte `CHECK`) | Exigence §10 |

## État d'avancement

| Phase | Contenu | Statut |
|---|---|---|
| **1** | Setup, identité, design system, accueil, navigation, auth | ✅ Livré |
| **2** | Schéma BDD complet (30+ tables), rôles, RLS, inscription consultant, profils, marketplace, recherche/filtres | ✅ Livré |
| **3** | Moteur de réservation, disponibilités, paiement modulaire (sandbox/Fapshi), webhooks, notifications + emails, dashboards | ✅ Livré |
| **4** | Répertoire pays, Centre de connaissances (lecture, recherche, filtres, sources, partage), workflow de publication | 🟡 Lecture + workflow livrés · **éditeur riche d'articles/pays à faire** |
| **5** | Assistant IA (RAG sur contenu vérifié), transfert vers un humain | 🔲 Tables `ai_conversations` / `ai_messages` / ticket `ai_handoff` prêtes · **à construire** |
| **6** | Admin : vue d'ensemble, vérifications, utilisateurs/rôles, réservations, paiements, commissions, analytics + export CSV, paramètres, audit | 🟡 Livré · **remboursements via API prestataire, réclamations, config IA à faire** |
| **7** | Tests sécurité/fonctionnels, perf, doc de déploiement | 🟡 17 tests BDD + 12 tests unitaires · **tests E2E Playwright à ajouter** |

## Prochaines étapes recommandées

1. `npm install && npm run build` en local, corriger d'éventuels écarts de types (le code n'a pas pu être compilé dans l'environnement de génération — voir README).
2. Brancher **Fapshi en sandbox** (clés Sandbox) et valider un paiement complet.
3. Phase 4 : éditeur Markdown d'articles + formulaire de catégories de visa (avec sources obligatoires).
4. Phase 5 : assistant IA — route `/api/assistant` en streaming, recherche plein-texte `articles.search` + `search_consultants()` comme outils, prompt système interdisant toute garantie de visa, bouton « Parler à un expert » qui crée un ticket `ai_handoff`.
5. Tests E2E Playwright du parcours d'acceptation §19 (15 étapes).

## Version 2 (prête pour la production)
- [x] Marque configurable (`NEXT_PUBLIC_SITE_NAME`, `{{brand}}` dans les messages)
- [x] Nouveau design (navy / teal, Plus Jakarta Sans + Inter), globe interactif
- [x] Accueil CEO, parcours « solutions adaptées à mon profil », comparateur d'experts, tri
- [x] 29 destinations enrichies (objectifs, opportunités, langues), page À propos
- [x] Certifications consultants (vérification admin uniquement)
- [x] Édition complète des consultants par l'admin + création par invitation
- [x] Tarifs : 15 000 / 25 000 FCFA / sur devis
- [x] sitemap, robots, PRODUCTION.md, reference-data.sql
- [ ] Phase 5 : assistant IA
