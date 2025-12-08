# Ghid: Ștergere Utilizatori și Creare Profiluri Noi

## 🔐 Funcționalități noi

Acum poți șterge utilizatori din `auth.users` și `profiles` table, și poți crea profiluri noi cu parolele dorite.

---

## 📋 Cum să ștergi un utilizator

### Pasul 1: Deschide Admin Dashboard
- Loghează-te cu contul de **admin** sau **CEO**
- Navigează la Admin Dashboard

### Pasul 2: Gestionează Angajații
- Apasă butonul **"👥 Gestionează Angajați"**
- Se va deschide o secțiune cu toți angajații din baza de date

### Pasul 3: Șterge utilizatorul
- Apasă butonul **"🗑️ Șterge"** lângă angajatul pe care vrei să-l ștergi
- Se va afișa un dialog de confirmare: **"Sigur vrei să ștergi acest angajat? Se va șterge și din auth.users!"**
- Apasă **OK** pentru a confirma

### ⚠️ Ce se va întâmpla
- Utilizatorul va fi șters din tabelul `auth.users` (via API)
- Utilizatorul va fi șters din tabelul `profiles`
- **Datele nu pot fi recuperate** - aceasta este o acțiune ireversibilă
- Contul CEO principal (`overviewview8@gmail.com`) nu poate fi șters

---

## ✅ Cum să creezi un profil nou

### Pasul 1: Deschide formular creare profil
- În secțiunea **"👥 Gestionare Angajați"**, derulează în jos
- Apasă butonul **"➕ Creează Profil Nou"**

### Pasul 2: Completează formularul
Introdu următoarele informații:

| Campo | Descriere | Exemplu |
|-------|-----------|---------|
| **Email** | Email-ul noului utilizator (trebuie să fie unic) | `ion.popescu@example.com` |
| **Nume Complet** | Numele complet al angajatului | `Ion Popescu` |
| **Parolă** | Parola inițială (min 6 caractere) | `SecurePass123` |
| **Confirmă Parola** | Repetă parola pentru confirmare | `SecurePass123` |
| **Rol** | Rolul utilizatorului în sistem | Employee / CEO / Admin |

### Pasul 3: Salvează profilul
- Apasă butonul **"✅ Creează Profil"**
- Vei vedea mesajul: **"✅ Profil nou creat cu succes!"**

---

## 🔄 Workflow Complet: Înlocuire Utilizator

Iată cum poți șterge un utilizator vechi și crea un nou profil cu același email:

1. **Șterge utilizatorul vechi**
   - Apasă "🗑️ Șterge" pe profilul pe care vrei să-l înlocuiești
   - Confirmă ștergerea

2. **Creează utilizatorul nou**
   - Apasă "➕ Creează Profil Nou"
   - Introdu aceleași email (acum disponibil din nou)
   - Setează o parolă nouă pentru utilizator
   - Selectează rolul dorit (Employee/Admin/CEO)
   - Apasă "✅ Creează Profil"

3. **Noul utilizator poate acum**
   - Se conecta la sistem cu email-ul și parola nouă
   - Accesa funcționalitățile conform rolului asignat

---

## 🛠️ Detalii Tehnice

### API Endpoint
- **URL**: `/api/delete-user`
- **Method**: `POST`
- **Body**: `{ "userId": "uuid" }`
- **Cerințe**: Doar utilizatorii cu rol `admin` sau `ceo` pot apela această funcție

### Variabile de mediu necesare
```env
REACT_APP_SUPABASE_URL=https://...
REACT_APP_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

⚠️ `SUPABASE_SERVICE_ROLE_KEY` este o variabilă **confidențială** și trebuie să rămână doar pe server (în Vercel environment variables).

### Fluxul de ștergere
1. Frontend apelează `/api/delete-user` cu ID-ul utilizatorului
2. API verifică dacă utilizatorul curent are rol admin/ceo
3. Dacă DA, ștergea utilizatorul din `auth.users` via Supabase Admin API
4. Frontend primește confirmarea și șterge din `profiles` table

---

## ❓ Întrebări Frecvente

**Q: Pot recupera un utilizator după ce l-am șters?**
A: Nu. Ștergerea este permanentă. Dacă faci o greșeală, trebuie să creezi din nou profilul.

**Q: Ce se întâmplă cu joburile/taskurile unui utilizator șters?**
A: Joburile și taskurile rămân în baza de date, dar nu vor mai fi asociate cu profilul șters.

**Q: Pot șterge contul CEO principal?**
A: Nu. Contul `overviewview8@gmail.com` este protejat și nu poate fi șters.

**Q: Care este parola inițială a unui utilizator nou?**
A: Parola pe care o introduci tu la crearea profilului. Doar tu o cunoști inițial.

**Q: Pot schimba parola unui utilizator după crearea sa?**
A: Momentan nu. Utilizatorul trebuie să-și schimbe parola prin "Forgot Password" sau tu trebuie să ștergi și recreezi profilul cu o parolă nouă.
