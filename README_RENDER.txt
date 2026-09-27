SOTOBOSQUEJO — PAQUETE LISTO PARA RENDER

OBJETIVO
Subir este proyecto a GitHub y desplegarlo gratis en Render para jugar desde 2 celulares por Internet.

ARCHIVOS IMPORTANTES
- server.js ........ servidor Node.js
- public/index.html  juego para los celulares
- package.json ..... configuración de Node
- render.yaml ...... configuración automática para Render

PASOS DESDE EL CELULAR

1. Crear un repositorio nuevo en GitHub.
2. Subir TODOS los archivos y carpetas de este ZIP al repositorio.
   Importante: server.js, package.json, render.yaml y la carpeta public deben quedar en la raíz.
3. Entrar a render.com y crear/iniciar sesión.
4. Elegir New > Web Service.
5. Conectar la cuenta de GitHub y seleccionar el repositorio de Sotobosquejo.
6. Render debería detectar automáticamente:
   Build Command: npm install
   Start Command: npm start
7. Elegir el plan Free si aparece disponible.
8. Crear el Web Service.
9. Cuando el despliegue termine, Render dará una URL pública parecida a:
   https://sotobosquejo.onrender.com
10. Abrir esa misma URL en los dos celulares.

CÓMO JUGAR
- Cada jugador pone su nombre y entra.
- El primer jugador es host.
- Cuando hay 2 jugadores, el host inicia la partida.
- Se alternan turnos para dibujar y adivinar.

INCLUYE
- 6 categorías.
- 60 segundos para dibujar.
- 20 o 30 segundos para adivinar.
- Pizarra blanca.
- Colores: rojo, amarillo, verde, azul, negro y violeta.
- Trazo fino/grueso.
- Herramienta de relleno.
- Puntaje.
- Sincronización entre ambos celulares.

NOTA
En el plan gratuito, Render puede suspender el servicio cuando está inactivo. La primera apertura posterior puede tardar un poco más mientras el servicio vuelve a arrancar.
