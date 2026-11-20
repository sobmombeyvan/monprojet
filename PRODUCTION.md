# Mise en production — pas à pas

Ordre conseillé : **staging d'abord** (projet Supabase + déploiement de test, paiements en mode test), puis **production**. Chaque environnement a son propre projet Supabase et ses propres clés.

---

## 1. Avant de commencer

- [ ] `npm run db:types && npm run typecheck && npm run build` passent en local
- [ ] `npm run check` passe (lint + tests unitaires)
- [ ] Nom définitif du site dans `NEXT_PUBLIC_SITE_NAME`, contact dans `NEXT_PUBLIC_CONTACT_EMAIL`
- [ ] Nom de domaine acheté (ex. `monprojet.com`)
- [ ] Pages légales (`/privacy`, `/terms`) relues par un juriste — ce sont des modèles

## 2. Supabase (base de données, comptes, fichiers)

1. Créez un projet sur [supabase.com](https://supabase.com) — région **eu-central-1 (Francfort)** ou **eu-west-3 (Paris)**, la plus proche du Cameroun.
2. Dans VS Code :
   ```bash
   supabase login
   supabase link --project-ref <ref-du-projet>
   supabase db push                       # applique les 5 migrations
   npm run db:types:remote
   ```
3. **Données de référence** (rôles, tarifs, 30 pays…) : Supabase › SQL Editor › collez le contenu de `supabase/reference-data.sql` › Run.
   ⚠️ N'exécutez **jamais** `seed.sql` en production (comptes de démo).
4. **Auth** › Providers › Email : confirmation d'e-mail **activée**.
   **Auth** › URL Configuration : Site URL `https://votre-domaine`, Redirect URLs `https://votre-domaine/auth/callback`.
5. **Auth** › SMTP : branchez un expéditeur (Resend, Brevo…) pour que les e-mails d'inscription et d'invitation partent de votre domaine.
6. **Storage** : les buckets sont créés par la migration 04 (photos publiques, documents privés). Rien à faire.
7. **Sauvegardes** : plan Pro → activez le *Point-in-Time Recovery*.
8. **Premier administrateur** : inscrivez-vous sur le site, puis dans le SQL Editor :
   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id from auth.users u, public.roles r
   where u.email = 'vous@votre-domaine.com' and r.key in ('admin', 'editor')
   on conflict do nothing;
   ```
9. Récupérez dans Settings › API : `Project URL`, `anon key`, `service_role key` (cette dernière reste **secrète**, côté serveur uniquement).

## 3. Hébergement (Vercel)

1. Poussez le code sur GitHub (dépôt privé).
2. [vercel.com](https://vercel.com) › New Project › importez le dépôt (framework détecté : Next.js).
3. Variables d'environnement (Settings › Environment Variables), séparées **Preview** (staging) / **Production** :

| Variable | Production |
|---|---|
| `APP_ENV` | `production` (désactive la sandbox de paiement) |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | vos valeurs |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projet Supabase de prod |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ secret |
| `PAYMENT_PROVIDER` | `fapshi` |
| `FAPSHI_ENV=live`, `FAPSHI_API_USER`, `FAPSHI_API_KEY`, `FAPSHI_WEBHOOK_SECRET` | voir §4 |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | expéditeur vérifié |
| `CRON_SECRET` | chaîne aléatoire longue |
| `UPSTASH_REDIS_REST_URL/TOKEN` | recommandé (limitation de débit partagée) |

4. Domaine : Settings › Domains › ajoutez `votre-domaine.com` et suivez les instructions DNS.
5. Tâche planifiée : `vercel.json` appelle `/api/cron/maintenance` toutes les 5 minutes (libère les créneaux non payés, envoie les e-mails). Sur le plan gratuit de Vercel (1 exécution/jour), utilisez plutôt pg_cron dans Supabase :
   ```sql
   select cron.schedule('release-holds', '* * * * *', $$select public.release_expired_holds()$$);
   ```

## 4. Paiements

### Fapshi — FCFA (MTN Mobile Money, Orange Money)

1. Créez un compte sur fapshi.com, puis tableau de bord › **Developers** › **New Service**.
2. **Test** : onglet *Sandbox* → `FAPSHI_API_USER`, `FAPSHI_API_KEY`, avec `FAPSHI_ENV=sandbox`.
   **Production** : compte activé, onglet *API* → clés live, `FAPSHI_ENV=live` (la clé live n'est affichée qu'une fois).
3. Webhook du service : `https://votre-domaine/api/webhooks/payments/fapshi`, avec le même secret que `FAPSHI_WEBHOOK_SECRET` (envoyé dans l'en-tête `x-wh-secret`).
4. `PAYMENT_PROVIDER=fapshi`. Fapshi n'accepte que le **XAF** (montant entier, minimum 100 FCFA) : tous les prix du site sont en XAF.
5. Si la liste blanche d'IP est activée dans Fapshi, ajoutez l'IP de sortie de votre hébergeur (sinon : erreur 403 à la création du paiement).
6. Sécurité : la notification Fapshi n'est pas signée ; le code **revérifie toujours** statut, montant et référence via `GET /payment-status/{transId}` avant de confirmer.
   Fapshi ne renvoie pas un webhook perdu : la page de confirmation et la tâche `/api/cron/maintenance` revérifient aussi les paiements en attente, et le lien de paiement est expiré quand le créneau est libéré.
7. Test sandbox : numéros MTN réussite `670000000`, échec `670000001` ; Orange réussite `690000000`, échec `690000001`.
8. Frais Fapshi : 3 %. Pas d'API de remboursement (remboursement = payout depuis un service dédié, ou depuis le tableau de bord).

### Tester avant d'ouvrir

- [ ] En staging, clés **sandbox** Fapshi (numéro 670000000) : une réservation complète passe jusqu'à « Réservation confirmée »
- [ ] Le webhook apparaît dans Administration › Paiements avec ✓ (aucune « processing_error »)
- [ ] Un paiement refusé laisse la réservation « en attente » puis expirée après 15 min
- [ ] Rejouer la même notification ne crée pas de double confirmation
- [ ] Passage aux clés **live** uniquement en production

## 5. Contenu à préparer

- [ ] Consultants réels : Administration › Consultants › **+ Ajouter un consultant** (invitation par e-mail), puis compléter bio, photo, certifications, services, disponibilités
- [ ] Vérifier chaque certification auprès de l'organisme émetteur avant de cocher « Vérifiée »
- [ ] Catégories de visa : uniquement avec URL officielle et date de vérification (contrainte en base)
- [ ] Prix des services : Administration › Paramètres (actuellement 15 000 / 25 000 FCFA / sur devis)

## 6. Sécurité — vérifications finales

- [ ] `SUPABASE_SERVICE_ROLE_KEY` absente de tout fichier commité et jamais préfixée `NEXT_PUBLIC_`
- [ ] `APP_ENV=production` (sandbox de paiement refusée)
- [ ] `robots.txt` autorise l'indexation uniquement en production (automatique)
- [ ] Supabase › Database › Advisors : aucune alerte de sécurité
- [ ] Monitoring d'erreurs (Sentry : `npx @sentry/wizard@latest -i nextjs`) — point d'accroche : `src/app/[locale]/error.tsx`

## 7. Après l'ouverture

- Surveillez Administration › Paiements (webhooks en erreur) et le journal d'audit.
- Mettez à jour les taux de change indicatifs dans `platform_settings.exchange_rates`.
- Prochaine étape produit : assistant IA (tables prêtes, voir PLAN.md, phase 5).
