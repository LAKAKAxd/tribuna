/* Rellena estos dos valores con los de tu proyecto de Supabase (Project Settings > API).
   La "anon public key" se puede publicar: los permisos los controla la base de datos.
   Si los dejas vacíos, la app arranca en modo demostración con datos simulados. */
window.TRIBUNA_CONFIG = {
  supabaseUrl: 'https://ulfxhbkoabqfyljteyab.supabase.co',
  supabaseAnonKey: 'sb_publishable_BJcJ4lvpenqIdjCcjxoOfg_FUsJtOdl',

  /* Escudos: false = escudos propios con los colores de cada equipo (se pueden publicar).
     true = logos oficiales de la NBA. Solo para uso privado: tienen derechos de marca. */
  logosOficiales: false,
  /* true = fotos oficiales de los jugadores (NBA.com). Solo uso privado. false = iniciales con los colores del equipo. */
  fotosOficiales: false,

  /* Fondos animados de jugador (opcional). id del jugador en NBA.com -> enlace https a un GIF, WEBP o MP4.
     También se pueden poner desde la propia ficha del jugador (solo el administrador).
     Si un jugador no tiene, se muestra una animación propia según su especialidad.
     Ejemplo: '201939': 'https://.../curry-triple.mp4', */
  fondos: {
  },

  /* Para corregir la especialidad calculada: tirador, director, pintura o anotador. */
  especialidades: {
  },
};
