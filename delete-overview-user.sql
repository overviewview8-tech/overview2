-- Șterge utilizatorul overview din baza de date
-- Rulează acest script în Supabase SQL Editor

-- 1. Mai întâi verifică ce utilizatori există
SELECT id, email, full_name, role FROM profiles;

-- 2. Șterge utilizatorul overview
DELETE FROM profiles 
WHERE email = 'overviewview8@gmail.com';

-- 3. Verifică din nou lista de utilizatori
SELECT id, email, full_name, role FROM profiles;
