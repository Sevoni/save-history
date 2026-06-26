# Save History

[English version](README.md) | [Русская версия](README.ru.md)

Plugin para Obsidian para guardar y restaurar versiones de archivos.

## Funcionalidades

- **Guardado manual de versiones** — guarda el estado actual de un archivo en cualquier momento
- **Restauración de versiones** — restaura cualquier versión guardada con un solo clic
- **Copia de seguridad antes de restaurar** — antes de restaurar, el estado actual se guarda automáticamente como respaldo
- **Comparación de diferencias** — compara dos versiones o una versión con el archivo actual (con resaltado a nivel de caracteres)
- **Vista previa** — previsualiza una versión antes de restaurarla (ventana arrastrable y redimensionable)
- **Agrupación de versiones** — agrupa versiones por día, semana, mes o año (plegable)
- **Renombrar etiquetas** — asigna nombres personalizados a las versiones guardadas
- **Eliminación masiva** — selecciona y elimina varias versiones a la vez
- **Exportar / Importar** — exporta una versión individual o todas las versiones de un archivo; importa versiones exportadas previamente
- **Guardado automático** — guarda versiones automáticamente en un intervalo configurable
- **Guardado al cerrar pestaña** — guarda una versión al cerrar la pestaña del archivo
- **Configuración por archivo** — sobrescribe el intervalo de autoguardado, el guardado al cerrar pestaña, el máximo de versiones automáticas y la agrupación por archivo
- **Máximo de versiones automáticas** — limita cuántas versiones automáticas se conservan por archivo
- **Extensiones de archivo permitidas** — elige qué tipos de archivo se rastrean (`.md` siempre incluido)
- **Multilingüe** — interfaz en inglés, ruso y español
- **Carpeta de instantáneas personalizable** — cambia dónde se almacenan las versiones en el vault
- **Carpeta de exportación personalizable** — carpeta de respaldo para exportaciones cuando el selector del navegador no está disponible
- **Seguimiento de renombrados** — las instantáneas siguen a los archivos y carpetas renombrados
- **Limpieza al eliminar archivos** — las instantáneas se eliminan automáticamente al borrar un archivo
- **Icono en la cinta** — acceso rápido al panel de historial
- **Comando restaurar última versión no guardada** — restaura rápidamente la copia de seguridad previa a la restauración

## Instalación

### Desde GitHub Releases

1. Descarga el último zip de [Releases](https://github.com/Sevoni/save-history/releases)
2. Extrae `main.js` y `manifest.json` en la carpeta `.obsidian/plugins/save history/` de tu vault
3. Activa el plugin en Ajustes de Obsidian → Plugins comunitarios

### Manual

1. Clona este repositorio
2. Ejecuta `npm install`
3. Ejecuta `npm run build`
4. Copia `main.js` y `manifest.json` a la carpeta `.obsidian/plugins/save history/` de tu vault

## Uso

- Abre un archivo en Obsidian
- Usa el panel lateral "Historial del archivo" para ver y gestionar versiones
- O usa los comandos desde la paleta de comandos:
  - **Guardar versión ahora** — guarda el estado actual
  - **Restaurar versión** — abre el modal de restauración
  - **Abrir panel de historial** — abre el panel de lista de versiones
  - **Restaurar última versión no guardada** — restaura la copia de seguridad previa a la restauración
- Haz clic derecho en un archivo del explorador para exportar o importar versiones

## Desarrollo

```bash
npm install
npm run build
```

Para vigilar cambios:

```bash
npm run watch
```

## Licencia

MIT
