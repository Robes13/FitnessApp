# Auth – sider

Route-komponenterne i auth-featuren. Begge er fotoskærme: `app-auth-backdrop` ligger absolut
bagved, og indholdet lægges ovenpå i en flex-kolonne, der fylder højden. De bruger derfor
**ikke** mixinen `page-screen` – der er ingen scroll-container, og der er ingen tab bar at gøre
plads til.

| Mappe                                                     | Skærm                                             |
| --------------------------------------------------------- | ------------------------------------------------- |
| [`login-page/`](login-page/README.md)                     | `/login` – brugernavn, adgangskode og fodnoterne. |
| [`forgot-password-page/`](forgot-password-page/README.md) | `/glemt-adgangskode` – de fire trin.              |
