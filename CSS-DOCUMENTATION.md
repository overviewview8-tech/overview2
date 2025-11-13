# 🎨 Overview - CSS Design System

## Documentație completă a sistemului de design

### 📁 Structura fișierelor CSS

```
src/
├── index.css                          # Stiluri globale și variabile CSS
├── App.css                            # Utilități și componente globale
├── components/
│   ├── EmployeeDashboard.css          # Stiluri Employee Dashboard
│   ├── AdminDashboard.css             # Stiluri Admin Dashboard
│   ├── CEODashboard.css               # Stiluri CEO Dashboard (Premium)
│   ├── Minimal.css                    # Stiluri Login & Signup
│   ├── UIComponents.css               # Componente UI reutilizabile
│   ├── Animations.css                 # Animații și efecte
│   └── DarkMode.css                   # Tema dark mode (opțional)
```

---

## 🎨 Paletă de Culori

### Culori Primare
- **Primary**: `#2563eb` (Albastru vibrant)
- **Secondary**: `#7c3aed` (Mov elegant)
- **Success**: `#10b981` (Verde proaspăt)
- **Danger**: `#ef4444` (Roșu de atenție)
- **Warning**: `#f59e0b` (Portocaliu cald)
- **Info**: `#3b82f6` (Albastru informativ)

### Culori Neutre
- **Dark**: `#1f2937` (Text principal)
- **Gray**: `#6b7280` (Text secundar)
- **Light Gray**: `#f3f4f6` (Fundal secundar)
- **Border**: `#e5e7eb` (Margini subtile)

---

## 🔘 Sistem de Butoane

### Butoane Principale
```css
.btn-primary     /* Gradient albastru-mov */
.btn-secondary   /* Gri neutru */
.btn-success     /* Verde */
.btn-danger      /* Roșu */
.btn-warning     /* Portocaliu */
.btn-info        /* Albastru info */
```

### Dimensiuni
```css
.btn              /* Standard: 12px padding, 14px font */
.btn-small        /* Mic: 8px padding, 12px font */
.btn-icon         /* Rotund: 40x40px */
.btn-icon-sm      /* Icon mic: 32x32px */
.btn-icon-lg      /* Icon mare: 48x48px */
```

### Variante Outline
```css
.btn-outline-primary
.btn-outline-success
.btn-outline-danger
```

### Floating Action Button
```css
.fab              /* Buton rotund flotant în colțul din dreapta jos */
```

---

## 📦 Componente Card

### Card-uri Standard
```css
.card             /* Card de bază cu padding și shadow */
.card-hover       /* Card cu efect hover și border */
.card-glass       /* Card transparent cu blur effect */
```

### Card-uri Specializate
```css
.job-card         /* Card pentru job-uri cu gradient header */
.task-card        /* Card pentru task-uri */
.stat-card        /* Card pentru statistici cu icon */
.employee-card    /* Card pentru profiluri angajați */
```

---

## 🏷️ Badge-uri și Tag-uri

### Badge-uri
```css
.badge            /* Badge standard */
.badge-primary
.badge-success
.badge-warning
.badge-danger
.badge-info
```

### Tag-uri
```css
.tag              /* Tag cu dimensiune standard */
.tag-sm           /* Tag mic */
.tag-lg           /* Tag mare */
```

### Pills
```css
.pill-primary
.pill-success
.pill-warning
.pill-danger
```

---

## 📊 Progress Bars

### Linear Progress
```css
.progress-bar              /* Container */
.progress-bar-fill         /* Fill cu gradient */
.progress-bar-striped      /* Cu linii animate */
```

### Circular Progress
```css
.circular-progress         /* Container SVG circular */
.circular-progress-text    /* Text din centru */
```

---

## 👤 Avatar System

### Dimensiuni Avatar
```css
.avatar           /* Standard: 40x40px */
.avatar-sm        /* Mic: 32x32px */
.avatar-lg        /* Mare: 56x56px */
.avatar-xl        /* Extra mare: 80x80px */
```

### Avatar Group
```css
.avatar-group     /* Grup de avatare suprapuse */
```

---

## 🎭 Animații

### Animații de Intrare
```css
.animate-fade-in          /* Fade simplu */
.animate-fade-in-up       /* Fade din jos în sus */
.animate-fade-in-down     /* Fade din sus în jos */
.animate-zoom-in          /* Zoom in */
.animate-bounce-in        /* Bounce la intrare */
```

### Animații de Atenție
```css
.animate-shake            /* Tremur */
.animate-pulse            /* Pulsare continuă */
.animate-bounce           /* Salt continuu */
.animate-wiggle           /* Mișcare laterală */
```

### Animații de Loading
```css
.animate-spin             /* Rotație */
.animate-shimmer          /* Efect shimmer pentru skeleton */
.animate-glow             /* Pulsare luminos */
```

### Efecte Hover
```css
.hover-lift               /* Ridicare la hover */
.hover-grow               /* Mărire la hover */
.hover-glow               /* Glow la hover */
.hover-rotate             /* Rotație la hover */
```

### Delay și Duration
```css
.delay-100, .delay-200, .delay-300, .delay-400, .delay-500
.duration-fast, .duration-normal, .duration-slow
```

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: max-width: 480px
- **Tablet**: max-width: 768px
- **Desktop**: max-width: 968px
- **Large Desktop**: max-width: 1400px

Toate componentele sunt responsive și se adaptează automat la dimensiunea ecranului.

---

## 🌓 Dark Mode (Opțional)

Pentru a activa dark mode, adaugă atributul `data-theme="dark"` pe elementul `<html>`:

```html
<html data-theme="dark">
```

Sau toggle dinamic cu JavaScript:
```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```

---

## 🎯 Utilități CSS

### Spacing
```css
.mt-8, .mt-16, .mt-24, .mt-32     /* Margin top */
.mb-8, .mb-16, .mb-24, .mb-32     /* Margin bottom */
.p-8, .p-16, .p-24, .p-32         /* Padding */
```

### Flexbox
```css
.flex                    /* Display flex */
.flex-column            /* Flex direction column */
.items-center           /* Align items center */
.justify-center         /* Justify center */
.justify-between        /* Justify space-between */
.gap-8, .gap-12, .gap-16, .gap-24
```

### Grid
```css
.grid                   /* Display grid */
.grid-cols-2            /* 2 coloane */
.grid-cols-3            /* 3 coloane */
.grid-cols-4            /* 4 coloane */
```

### Text
```css
.text-sm, .text-base, .text-lg, .text-xl, .text-2xl, .text-3xl
.font-normal, .font-medium, .font-semibold, .font-bold
.text-primary, .text-success, .text-danger, .text-warning, .text-gray, .text-dark
```

### Background
```css
.bg-primary, .bg-success, .bg-danger, .bg-warning, .bg-light, .bg-white
```

---

## 💡 Sfaturi de Utilizare

### 1. Consistență
Folosește întotdeauna clasele CSS predefinite pentru o experiență uniformă în toată aplicația.

### 2. Responsivitate
Toate componentele sunt responsive by default. Nu este nevoie de media queries suplimentare în cele mai multe cazuri.

### 3. Animații
Folosește animații cu moderație pentru a nu distrage utilizatorul. Adaugă clase de animație doar când are sens pentru UX.

### 4. Culori
Folosește variabilele CSS pentru culori (`var(--primary-color)`) pentru a facilita schimbarea temelor în viitor.

### 5. Performance
- Animațiile folosesc `transform` și `opacity` pentru performanță optimă
- Toate tranzițiile sunt optimizate pentru 60fps

---

## 🚀 Exemple de Utilizare

### Buton cu animație
```html
<button class="btn btn-primary animate-bounce-in delay-200">
  Click Me!
</button>
```

### Card cu hover effect
```html
<div class="card hover-lift animate-fade-in-up">
  <h3>Card Title</h3>
  <p>Card content...</p>
</div>
```

### Avatar group
```html
<div class="avatar-group">
  <div class="avatar">JD</div>
  <div class="avatar">MK</div>
  <div class="avatar">AL</div>
</div>
```

### Progress bar animated
```html
<div class="progress-bar progress-bar-striped">
  <div class="progress-bar-fill" style="width: 75%;"></div>
</div>
```

---

## 📝 Contribuții

Când adaugi noi stiluri CSS:
1. Respectă convenția de naming (kebab-case)
2. Adaugă comentarii pentru secțiuni noi
3. Testează pe toate dimensiunile de ecran
4. Actualizează această documentație

---

## 🎨 Design System Credits

Design system creat cu:
- **CSS Variables** pentru tematizare ușoară
- **Flexbox & Grid** pentru layout modern
- **CSS Animations** pentru interacțiuni fluide
- **Mobile-First Approach** pentru responsive design

**Version**: 1.0.0  
**Last Updated**: November 2025  
**Designed for**: Overview Project Management System
