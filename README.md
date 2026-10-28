# Aire · Wiehre

App web móvil para estimar la ventilación necesaria para reducir la humedad en habitaciones de Freiburg-Wiehre.

## Uso

Sirve esta carpeta con un servidor estático, por ejemplo `python3 -m http.server 8000`, y abre `index.html`. No requiere compilación ni dependencias.

Consulta Open-Meteo, permite medición exterior manual, lecturas y ajustes por habitación y temporizador de revisión. Los ajustes se guardan en el navegador.

## Límites

Utiliza la fórmula de Magnus y un modelo de mezcla con renovaciones de aire supuestas o introducidas por el usuario. El tiempo es orientativo: comprueba el higrómetro tras cerrar y recuperar la temperatura. No garantiza prevenir moho ni resuelve filtraciones o puentes térmicos.

Datos meteorológicos: https://open-meteo.com/ (modelo para la zona, no sensor en Wiehre Bahnhof).
