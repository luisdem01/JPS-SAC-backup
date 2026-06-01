# SGPI MAAPI (Módulo de Autenticación API)

Este directorio contiene la **API de Autenticación** para el Sistema de Gestión de Proyectos de Investigación (SGPI). Es un servicio backend desarrollado con **Node.js** y **Express** que se integra con **Supabase** para gestionar el registro, inicio de sesión y verificación de usuarios.

## 📌 Propósito General

El objetivo de este módulo es centralizar la lógica de seguridad y acceso al sistema. Sus funciones principales incluyen:
- Registro de nuevos usuarios.
- Autenticación (Login) y generación de sesiones.
- Verificación de identidad a través de tokens (Endpoint `/me`).

## ⚙️ Requisitos Previos

Para que este módulo funcione correctamente, necesitas tener instalado lo siguiente en tu entorno de desarrollo:
- **Node.js** (versión 18 o superior recomendada).
- **npm** (gestor de paquetes de Node, que se instala junto con Node.js).
- Una cuenta en **[Supabase](https://supabase.com/)** con un proyecto activo (para obtener las credenciales de base de datos y autenticación).

## 🚀 Proceso de Configuración y Ejecución

Sigue estos pasos para poner en marcha la API de Autenticación localmente:

### 1. Instalar las dependencias
Abre una terminal en esta carpeta (`SGPI_MAAPI`) y ejecuta el siguiente comando para descargar todas las librerías necesarias (Express, Cors, Dotenv, Supabase JS, etc.):
```bash
npm install
```

### 2. Configurar las Variables de Entorno
El proyecto necesita ciertas credenciales para conectarse a Supabase y definir su entorno.
1. Haz una copia del archivo `.env.example` y renómbralo a `.env`.
2. Abre el archivo `.env` y completa los valores con la información de tu proyecto (por ejemplo, `PORT`, `FRONTEND_URL`, y las variables de Supabase como la URL y la Key pública/privada).

### 3. Ejecutar el Servidor
Tienes dos opciones para levantar el servidor, dependiendo de lo que necesites:

- **Modo Desarrollo (Recomendado para programar):**
  Este modo reiniciará automáticamente el servidor si detecta cambios en el código.
  ```bash
  npm run dev
  ```

- **Modo Producción:**
  Levanta el servidor de forma estándar.
  ```bash
  npm start
  ```

Si todo está configurado correctamente, verás en la consola un mensaje indicando que el servidor está corriendo (por defecto en `http://localhost:3000`) junto con la lista de endpoints disponibles.

## 📂 Estructura del Directorio

- `server.js`: El archivo principal de la aplicación. Configura Express, middlewares (CORS, JSON), el manejo de errores globales y define el puerto de escucha.
- `api/`: Carpeta que contiene los enrutadores y controladores de la API (por ejemplo, las rutas de autenticación en `api/auth/auth.routes.js`).
- `supabase/`: Contiene la configuración y el cliente de conexión para comunicarse con el backend de Supabase.
- `.env` / `.env.example`: Archivos para la gestión de variables de entorno y configuración sensible.
- `package.json`: Archivo de configuración del proyecto de Node.js donde se definen los scripts y las dependencias.
