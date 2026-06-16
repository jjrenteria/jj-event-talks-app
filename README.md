# BigQuery Release Pulse 📡

**BigQuery Release Pulse** es una aplicación web interactiva que consume, organiza y visualiza las notas de lanzamiento oficiales de Google Cloud BigQuery. La aplicación divide las notas del feed XML original en tarjetas individuales categorizadas y permite a los usuarios buscar y compartir actualizaciones de manera automatizada en X (Twitter).

---

## ✨ Características Principales

*   **Segmentación de Lanzamientos**: Parsea el feed Atom de Google Cloud y fragmenta las entradas complejas en notas individuales clasificadas por tipo.
*   **Identificación Visual Dinámica**: Tarjetas interactivas codificadas por colores:
    *   🟢 **Feature**: Nuevas capacidades y características.
    *   🟡 **Issue**: Problemas detectados y actualizaciones sobre resolución de bugs.
    *   🔴 **Breaking**: Cambios críticos no compatibles hacia atrás.
    *   🔵 **Change**: Modificaciones o mejoras sobre funciones existentes.
    *   🟣 **Announcement**: Comunicados generales e información relevante.
*   **Filtros y Búsqueda Instantánea**: Búsqueda en tiempo real a través de texto y filtros rápidos por categorías de lanzamiento.
*   **Estadísticas en Tiempo Real**: Panel de control con contadores animados por tipo de lanzamiento.
*   **Compartir en X (Twitter)**: Modal interactivo nativo con borrador de tweet autocompuesto y recortado de forma inteligente para cumplir con el límite de 280 caracteres. Incluye un indicador circular de progreso de caracteres.
*   **Copiar Enlaces Directos**: Copia enlaces directos que hacen scroll automático y resaltan un lanzamiento específico al ser compartidos.
*   **Caché en Memoria**: Mecanismo de caché resiliente de 5 minutos en el servidor para evitar sobrecargar el feed original y garantizar tiempos de carga instantáneos.

---

## 🛠️ Estructura del Proyecto

*   `app.py`: Servidor Flask en Python, lógica de parseo XML Atom con BeautifulSoup4 y caché del backend.
*   `templates/index.html`: Estructura HTML5 de la aplicación, panel de estadísticas y modal de Twitter.
*   `static/css/style.css`: Estilos visuales adaptables (diseño responsive), efectos de difuminado de fondo (glassmorphism) y animaciones de carga.
*   `static/js/app.js`: Lógica del cliente, filtrado interactivo en vivo, copiado al portapapeles y cálculo de caracteres para compartir en X.
*   `requirements.txt`: Dependencias del servidor Python.
*   `.gitignore`: Exclusiones para el control de versiones (Git).

---

## 🚀 Instalación y Uso

### Prerrequisitos
Asegúrate de tener instalado Python 3.9 o superior.

### 1. Clonar el repositorio
```bash
git clone https://github.com/jjrenteria/jj-event-talks-app.git
cd jj-event-talks-app
```

### 2. Instalar dependencias
Se recomienda utilizar un entorno virtual:
```bash
# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Linux/macOS
# o venv\Scripts\activate en Windows

# Instalar los paquetes requeridos
pip install -r requirements.txt
```

### 3. Ejecutar la aplicación
Ejecuta el servidor de desarrollo Flask:
```bash
python3 app.py
```
*Por defecto, la aplicación estará disponible en [http://localhost:5000](http://localhost:5000).*

---

## 🔒 Licencia
Este proyecto es de código abierto. Puedes usarlo y adaptarlo según tus necesidades.
