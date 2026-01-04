# Database Migration Guide

## Migrations

### 1. Add custom_keybinds column (2026-01-04)

**Formål:** Tilføjer `custom_keybinds` kolonne til `user_settings` tabellen.

**Fil:** `migrations/add-custom-keybinds.sql`

### 2. Create deleted_items table (2026-01-04)

**Formål:** Opretter `deleted_items` tabel til papirkurv/trash funktionalitet.

**Fil:** `migrations/create-deleted-items-table.sql`

---

## Hvordan køres migrationer

1. Gå til Supabase Dashboard: https://supabase.com/dashboard
2. Vælg dit projekt (DM Planner)
3. Gå til **SQL Editor** i venstre menu
4. Åbn migrations filen
5. Kopier SQL koden
6. Indsæt i SQL Editor og klik **Run**

### Kør begge migrationer i rækkefølge:

```sql
-- 1. Først: add-custom-keybinds.sql
-- 2. Derefter: create-deleted-items-table.sql
```

---

## Verificer migrationer

### Check custom_keybinds kolonne:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings' 
  AND column_name = 'custom_keybinds';
```

### Check deleted_items tabel:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'deleted_items'
ORDER BY ordinal_position;
```

---

## Hvad løser disse migrationer?

### Problem 1: Collections forsvinder efter refresh ✅
- **Løsning:** Slettede collections og scenes flyttes nu til `deleted_items` tabel
- Data fjernes fra originale tabeller og kan gendannes i op til 30 dage

### Problem 2: Custom keybinds forsvinder efter refresh ✅
- **Løsning:** `custom_keybinds` kolonne tilføjet til databasen
- Keybinds gemmes og indlæses via userSettingsService

---

## Trash/Papirkurv System

Når brugeren sletter en scene eller collection:

1. **Scene sletning:**
   - Scene flyttes til `deleted_items` med `item_type = 'scene'`
   - Originalen slettes fra `scenes` tabel
   - Kan gendannes i 30 dage

2. **Collection sletning:**
   - Collection flyttes til `deleted_items` med `item_type = 'collection'`
   - Alle scenes i collection gemmes embedded i `data` feltet
   - Originaler slettes fra `scenes` og `user_settings.collections`
   - Kan gendannes i 30 dage (inkl. alle scenes)

### Auto-cleanup (valgfrit)
Items har `expires_at` sat til 30 dage efter sletning.
Du kan oprette en scheduled function i Supabase til at slette expired items:

```sql
-- Kør dagligt via pg_cron eller Edge Function
DELETE FROM deleted_items WHERE expires_at < now();
```
