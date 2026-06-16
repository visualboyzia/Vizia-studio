# VIZIA Finanzas — poner el backend en marcha

La app ya funciona **sin hacer nada**: abre `index.html` y guarda los datos en tu
dispositivo (modo local). Para que **tú y Franco compartan todo en vivo** desde sus
celulares, conecta Supabase (gratis). Son ~10 minutos, una sola vez.

## 1. Crear el proyecto
1. Entra a https://supabase.com → **Start your project** → crea cuenta.
2. **New project**. Ponle nombre (ej. `vizia-finanzas`), elige región **South America (São Paulo)** y una contraseña de base de datos (guárdala).
3. Espera ~2 min a que termine de crearse.

## 2. Crear las tablas
1. En el menú izquierdo: **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql`, copia **todo** y pégalo.
3. Botón **Run**. Debe decir *Success*. (Esto crea las tablas y los datos de ejemplo.)

## 3. Crear los 2 usuarios (tú y Franco)
1. Menú izquierdo: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Crea uno para ti (tu correo + una contraseña) y otro para Franco.
   - Marca **Auto Confirm User** para que no necesiten correo de verificación.

## 4. Conectar la app
1. Menú izquierdo: **Project Settings** → **API**.
2. Copia **Project URL** y la **anon public** key.
3. Abre `config.js` y pégalas:
   ```js
   window.VIZIA_CONFIG = {
     url: 'https://TU-PROYECTO.supabase.co',
     anonKey: 'eyJhbGciOi...tu-anon-key',
     users: [
       { id: 'N', name: 'Nicolás',         email: 'TU-CORREO@gmail.com' },
       { id: 'F', name: 'Franco Otiniano', email: 'CORREO-DE-FRANCO@gmail.com' },
     ],
   };
   ```
4. Recarga la app. Ahora al entrar pide **contraseña** y los datos viven en la nube:
   lo que uno registra, el otro lo ve al instante.

## Notas
- **Modo local vs nube:** si `url`/`anonKey` están vacíos → local (este dispositivo).
  Con llaves → nube compartida. El puntito del botón "Protegido" lo indica.
- **Subirla a internet** (para abrirla como app en el celular): sube esta carpeta a
  Vercel o Netlify (gratis, arrastrar y soltar) y tendrás un link `https://`.
- **Pendiente de definir luego:** conexión automática a correo/banco, comisión 10% al
  socio que cierra el trato, IGV detallado, y que un ingreso asignado a un proyecto
  suba solo el % cobrado. Todo eso se monta sobre esta base.
