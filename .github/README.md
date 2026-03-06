# GitHub Actions for Supabase Keepalive

Dette projekt bruger en GitHub Action til at holde Supabase-databasen aktiv.

## Setup

For at GitHub Action kan fungere, skal du tilføje dine Supabase credentials som secrets:

1. Gå til dit GitHub repository
2. Klik på **Settings** → **Secrets and variables** → **Actions**
3. Tilføj følgende secrets:

   - **SUPABASE_URL**: Din Supabase projekt URL (f.eks. `https://xxxxx.supabase.co`)
   - **SUPABASE_ANON_KEY**: Din Supabase anon/public key

## Sådan fungerer det

- GitHub Action kører automatisk **hver dag kl. 12:00 UTC** (13:00/14:00 dansk tid)
- Den laver et simpelt API-kald til Supabase for at holde projektet aktivt
- Dette forhindrer at Supabase går i dvale-tilstand (inaktiv) på gratis planer

## Manuel kørsel

Du kan også køre workflowet manuelt:

1. Gå til **Actions** tab i dit GitHub repository
2. Vælg "Keep Supabase Active" workflow
3. Klik på **Run workflow**

## Monitoring

Tjek workflow historikken under **Actions** tab for at se om keepalive job'et kører succesfuldt.
