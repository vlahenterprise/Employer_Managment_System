# Employer Management System — App Brand Book

Ovaj dokument je interni **brand book same aplikacije** — ne kompanijskog brenda uopšte, već tačno onoga kako je ova aplikacija vizuelno i UX koncipirana, da bi druga aplikacija za istu kompaniju mogla da izgleda **isto, dosledno i prepoznatljivo**.

Ovo je izvučeno direktno iz implementacije aplikacije, bez menjanja koda.

## 1. Suština vizuelnog identiteta

Vizuelni karakter aplikacije je:

- **tamna, luksuzna, premium enterprise** estetika
- dominantna **crna / skoro crna** podloga
- **narandžasta** kao primarni akcioni i brend akcenat
- hladni svetli tonovi za tekst i sekundarne površine
- veliki radius-i, meke senke i “glass / layered dark surface” osećaj
- jasne kartice, KPI blokovi, status pill-ovi i dark admin shell

Ukratko:  
**dark premium operations UI + VLAH orange accent + jasna enterprise čitljivost**

---

## 2. Glavni brend asseti

### Primarni logo

- Glavni logo asset:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/public/branding/vlah-enterprise-dark.svg`

### Gde se koristi

- kao glavni logo aplikacije u shell-u
- kao watermark u pozadini
- kao fallback logo ako admin settings nema custom logo

### Source of truth za branding

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/settings.ts`

Branding je settings-driven i koristi ove ključeve:

- `AppTitle`
- `AppSubtitle`
- `Logo_link`
- `LogoVersion`
- `PoweredByText`

Default vrednosti su:

- `AppTitle`: `Employer Management System`
- `AppSubtitle`: `Internal HR and operations platform`
- `PoweredByText`: `Powered by VLAH ENTERPRISE`

Preporuka za novu aplikaciju:

- zadrži isti layout logotipa
- koristi isti watermark princip
- koristi isti “Powered by VLAH ENTERPRISE” footer treatment

---

## 3. Primarne boje

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/settings.ts`
- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

### Osnovna paleta

| Uloga | CSS var | Vrednost |
|---|---|---|
| Glavna pozadina | `--color-main` | `#050505` |
| Primarni akcenat | `--color-secondary` | `#F05123` |
| Glavni tekst | `--color-font-main` | `#E4EEF0` |
| Sekundarni tekst | `--color-font-secondary` | `#A0A7A8` |
| Tamna površina 1 | `--color-dark-1` | `#0B0B0B` |
| Tamna površina 2 | `--color-dark-2` | `#161616` |
| Svetli ton 1 | `--color-light-1` | `#E4EEF0` |
| Svetli ton 2 | `--color-light-2` | `#C6CCCD` |

### Funkcionalni akcenti

| Uloga | CSS var | Vrednost |
|---|---|---|
| Plavi akcenat | `--color-accent-blue` | `#5252FF` |
| Zlatni akcenat | `--color-accent-gold` | `#E9C46A` |
| Teal akcenat | `--color-accent-teal` | `#264653` |
| Cyan akcenat | `--color-accent-cyan` | `#8ECAE6` |
| Amber akcenat | `--color-accent-amber` | `#FFB703` |
| Danger | `--color-danger` | `#C62828` |
| Success / OK | `--color-ok` | `#1E8E6A` |

### Praktična upotreba boja

- **Crna / dark surfaces** = osnova celog proizvoda
- **Narandžasta** = primarna akcija, aktivno stanje, važna pažnja, branded highlight
- **Svetlo siva / bela** = sadržaj, tekst, sekundarna razdvajanja
- **Crvena** = danger / kritično / delete
- **Zelena** = success / approved / healthy state
- **Plava / cyan / gold / teal / amber** = pomoćne vizualizacije, grafici i sekundarni akcenti

Za novu aplikaciju:

- narandžastu koristi štedljivo i namerno
- nikad ne pravi šarenilo kao glavnu estetiku
- dark shell mora da ostane dominantan

---

## 4. Tipografija

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/layout.tsx`
- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

### Osnovni font

- `Inter`
- učitava se kroz Next font:
  - weights: `400, 500, 600, 700, 800`

### Font stack

Body:

- `var(--font-body, "SF Pro Text"), "SF Pro Text", "Helvetica Neue", Arial, sans-serif`

Headings:

- `var(--font-heading, var(--font-body, "SF Pro Text")), "SF Pro Display", "SF Pro Text", system-ui, sans-serif`

### Tipografski karakter

- jaki naslovi
- zategnuti tracking kod velikih naslova
- bold i semibold često korišćeni za KPI i sekcije
- sekundarni tekst u hladnijoj, smirenoj sivoj

### Preporuka

Za novu aplikaciju:

- koristi isti `Inter` setup
- iste weight-e
- iste kontraste između naslova, labela i muted opisa

---

## 5. Layout i shell

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/layout.tsx`
- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`
- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/components/AppNavigation.tsx`

### Globalni shell

Aplikacija koristi:

- tamnu full-screen pozadinu
- suptilne radial narandžaste glow slojeve
- jedva vidljivu grid teksturu preko cele pozadine
- watermark logotipa u donjem/desnom delu
- fixed language toggle gore desno
- fixed “Powered by” tekst dole levo

### Pozadinski izgled

Karakter pozadine:

- tamni linear gradient od `dark-2` ka `main`
- narandžasti glow iz gornjeg centralnog dela
- dodatni slabiji glow sa desne i donje strane
- grid overlay sa velikim kvadratima

To daje luksuzni “internal operations platform” utisak.

### Auth shell

Za ulogovanog korisnika koristi se:

- levi sidebar
- desna radna zona
- veliki centralni canvas za page sadržaj

Layout:

- sidebar širina: oko `228px`
- desktop shell koristi grid sa sidebar + content

### Maksimalna širina

U CSS root postoji fallback:

- `--page-max-width: 1660px`

Ali runtime settings preko servera daju efektivni default:

- `1320px` ako nije drugačije podešeno u settings

**Za novu aplikaciju računaj na settings-driven pristup kao source of truth.**

---

## 6. Radius, površine i senke

### Radius sistem

| Uloga | Vrednost |
|---|---|
| `--radius-sm` | `12px` |
| `--radius-md` | `16px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `26px` |
| `--radius-pill` | `999px` |

### Surface sistem

| Varijabla | Uloga |
|---|---|
| `--surface-0` | gotovo crna, najteža pozadina |
| `--surface-1` | osnovna dark panel površina |
| `--surface-2` | tamnija sekundarna kartica |
| `--surface-3` | vrlo blag svetli sloj |
| `--surface-4` | jači svetli sloj za hover/contrast |

### Senke

- `--shadow-card`: duboka premium card senka
- `--shadow-float`: floating panel senka
- `--shadow-inset`: blagi unutrašnji highlight
- `--focus-ring`: narandžasti fokus ring

Ovo zajedno daje dark-luxury UI, bez jeftinog sjaja.

---

## 7. Navigacija

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/components/AppNavigation.tsx`

### Navigaciona logika

Sidebar je podeljen po grupama:

- `Work / Rad`
- `Personal / Lično`
- `HR`
- `Admin`

### Ikonice po modulima

Mapiranje je vrlo dosledno:

- `Home / Dashboard` → home
- `Organization / Team / Candidates` → users
- `Tasks` → tasks
- `Reports` → report
- `Absence` → calendar
- `Performance` → sparkles
- `Management / HR` → briefcase
- `Profile` → user
- `Inbox` → inbox
- `Onboarding` → check circle
- `Admin / Access / Settings` → settings

### Vizuelni stil navigacije

- dark card sidebar
- grupisane sekcije koje se šire/sklapaju
- active link sa narandžastim akcentom
- badge broj item-a po grupi
- mobilni drawer za manje ekrane

### Pravilo za novu aplikaciju

Ako želiš isti osećaj:

- koristi isti sidebar koncept
- iste grupe
- isti active/hover treatment
- iste ikonice ili vrlo sličan outline stil

---

## 8. Kartice i paneli

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

### Panel

`.panel` koristi:

- tamnu layered pozadinu
- skoro nevidljiv gradient outline
- veliki radius
- unutrašnji sjaj

Koristi se za:

- glavne sekcije
- forms
- summary blokove

### Card / item

`.item` i `.card` family koriste:

- dark translucent background
- blagi gradient frame
- meki hover lift
- luksuzni, ali nenametljiv kontrast

### Chart card

`.chart-card`:

- isti surface jezik kao panel
- veći padding
- meki hover
- nema jak border, već elegantan maskirani outline

### KPI card

`.kpi-card`:

- kompaktan dark blok
- levo ikonica u narandžastom tile-u
- desno label + velika vrednost
- čista enterprise KPI prezentacija

---

## 9. Dugmad

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

### Primarno dugme

`.button`

Karakter:

- jaka narandžasta pozadina
- beli tekst
- high-contrast
- bold (`800`)
- blagi glow/shadow
- hover = mali lift + malo svetlije

### Sekundarno dugme

`.button-secondary`

Karakter:

- dark translucent
- slabiji border
- za manje dominantne akcije

### Danger dugme

`.button-danger`

Karakter:

- crvena gradient pozadina
- ista struktura kao primarno

### Pravilo

- Narandžasto = glavna akcija
- Dark secondary = pomoćna akcija
- Crveno = opasna akcija

Ovo obavezno zadrži i u drugoj aplikaciji.

---

## 10. Forme i input polja

### Input stil

`.input`

Karakter:

- dark translucent field
- veoma blag border
- svetli tekst
- narandžasti focus ring
- placeholder u hladnoj sivoj

### Textarea

- ista porodica kao input
- vertical resize
- dovoljno vazduha

### Opšti osećaj

Forme nisu “office gray”.  
One su **dark polished inputs** sa luks kontrastom.

---

## 11. Tabovi i pill-ovi

### Tabs

`.tab`, `.tab-active`

Karakter:

- dark, blagi hover
- aktivni tab dobija narandžasti tint i ring

### Pill-ovi

Koriste se za:

- status
- role/add-on info
- org tier
- priority
- info tagove

Pill-ovi su:

- mali
- zaobljeni
- vrlo čitljivi
- često uppercase ili polu-strong label karaktera

To je važan deo app identiteta.

---

## 12. Tooltip / help pattern

### Tooltip stil

Klase:

- `.help-tooltip`
- `.help-tooltip-button`
- `.help-tooltip-card`

Karakter:

- mala info/help ikonica
- dark floating card
- soft border
- neagresivna pomoć

### UX pravilo

Tooltip nije dekoracija.  
On je deo “enterprise guidance” tona aplikacije.

Nova aplikacija treba da:

- koristi isti helper pattern
- objašnjava termine, statuse i akcije
- ne preoptereti ekran

---

## 13. Data vizualizacija

Source of truth:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/settings.ts`
- chart kartice i rank/bar pattern u `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

### Chart pravila

- dark chart cards
- narandžasta je primarni data akcenat
- ostale boje su pomoćne:
  - amber
  - blue
  - cyan
  - gold
  - teal
  - green
  - red
  - neutral gray

### Preferirani osećaj

- manje šarenila
- više čitljivosti
- jači emphasis na bar/rank/list chart pristup
- donut/ring samo gde ima smisla

### Reusable chart palette

Implementirana kroz:

- `buildChartPalette(...)`

iz:

- `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/settings.ts`

---

## 14. ORG System vizuelni jezik

ORG modul ima svoj potpis, ali je i dalje u istom brand sistemu.

### Nivoi pozicija

| Nivo | Vizuelni tretman |
|---|---|
| Director | crni header / gotovo crna oznaka |
| Manager | narandžasti header |
| Lead | svetlija narandžasta |
| Supervisor | još svetlija narandžasta / krem-narandžasta |
| Staff | sivi / neutral header |

### ORG UI elementi

- zoom kontrole
- fullscreen canvas
- dark detail panel
- level legend
- search block
- scrollable chart viewport

### Važno

Ako praviš novu aplikaciju za istu firmu:

- ORG modul možeš vizuelno direktno naslediti
- taj tier sistem je već odlična interna metafora za hijerarhiju

---

## 15. Jezik i ton proizvoda

Iako je vizuelno premium, ton aplikacije nije hladan ni tehnički agresivan.

Treba da bude:

- jasan
- profesionalan
- operativan
- ljudski
- bez previše korporativne prazne priče

Naslovi i helper tekstovi treba da zvuče kao:

- “šta sada treba da uradiš”
- “šta ova sekcija radi”
- “šta ovaj status znači”

Ne kao birokratski ERP.

---

## 16. Šta obavezno zadržati u sledećoj aplikaciji

Ako želiš isti izgled, obavezno sačuvaj:

1. **Dark shell + orange glow pozadinu**
2. **VLAH logo + watermark koncept**
3. **Inter/SF Pro tipografski osećaj**
4. **Sidebar navigaciju sa grupama**
5. **Premium dark cards sa mekim gradient outline-om**
6. **Narandžasto primarno dugme**
7. **Pill/status jezik**
8. **Tooltip/help pattern**
9. **KPI kartice sa ikonama**
10. **ORG tier color logic**

Ako samo boje kopiraš bez ovih obrazaca, nova aplikacija neće delovati kao ista porodica proizvoda.

---

## 17. Šta ne raditi

Da bi nova aplikacija ostala u istom identitetu, izbegavaj:

- svetle bele pozadine kao dominantne
- ravne “Bootstrap” forme i tabove
- previše tankih bordera bez dubine
- previše šarenih chartova
- različite fontove od ekrana do ekrana
- velike UI eksperimente koji ruše dark premium osećaj
- neumorphism ili “playful SaaS” stil

---

## 18. Source-of-truth fajlovi za novu aplikaciju

Ako želiš 1:1 isti vizuelni jezik, ovo su najvažniji fajlovi:

- Theme + globalni vizuelni sistem:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/globals.css`

- Branding settings / boje / logo / chart palette:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/settings.ts`

- App shell i globalni layout:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/app/layout.tsx`

- Sidebar navigacija:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/components/AppNavigation.tsx`

- Primarni logo asset:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/public/branding/vlah-enterprise-dark.svg`

---

## 19. Kratak praktični “copy this into next app” rezime

Ako novu aplikaciju želiš da napraviš da izgleda kao ova, minimum koji treba da prekopiraš je:

- isti logo
- istu dark pozadinu sa glow + grid overlay
- istu color paletu
- istu typography postavku
- isti sidebar shell
- isti button/input/card stil
- isti tooltip/help pattern
- isti KPI/pill/status treatment

To će dati osećaj da je nova aplikacija **deo istog VLAH softverskog sistema**, a ne neki odvojen proizvod.

---

## 20. Napomena o prilagodljivosti

Najbolja stvar u postojećoj aplikaciji je što je već delom settings-driven.

To znači da u sledećoj aplikaciji možeš:

- zadržati isti vizuelni sistem
- a po potrebi menjati:
  - logo
  - title
  - subtitle
  - page width
  - theme boje

bez razbijanja identiteta.

---

## 21. Preporuka za sledeći korak

Ako želiš, sledeći korak može biti:

1. da ti iz ovog napravim i **kraći “implementation spec”** za developera  
   (tačno koje klase, boje i pattern-e da prekopira)

ili

2. da ti napravim **JSON / tokens / CSS variables extract**  
   koji možeš direktno da koristiš u novoj aplikaciji kao design tokens set.

