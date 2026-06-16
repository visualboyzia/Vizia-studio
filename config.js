// VIZIA Finanzas — configuración del backend
// ───────────────────────────────────────────────────────────────
// Mientras url y anonKey estén vacíos, la app guarda los datos en
// ESTE dispositivo (modo local). Para que tú y Franco compartan todo
// en vivo, crea un proyecto gratis en https://supabase.com y pega aquí:
//   1) Project Settings → API → Project URL        →  url
//   2) Project Settings → API → anon public key     →  anonKey
//   3) El correo con el que crearás cada usuario     →  email
// (Pasos detallados en SETUP.md)
window.VIZIA_CONFIG = {
  url: '',          // ej. https://abcdefgh.supabase.co
  anonKey: '',      // ej. eyJhbGciOiJIUzI1NiIsInR5cCI6...
  users: [
    { id: 'N', name: 'Nicolás',         email: '' },
    { id: 'F', name: 'Franco Otiniano', email: '' },
  ],
};
