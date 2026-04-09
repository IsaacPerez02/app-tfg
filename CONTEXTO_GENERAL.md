# 📱 CONTEXTO GENERAL - Universidad App

**Última actualización**: 2026-04-07  
**Estado**: Desarrollo en progreso  
**Modelo**: Trading/Inversión + Chat integrado

---

## 🎯 Visión General

Aplicación multiplataforma (iOS/Android/Web) de inversión y trading con IA integrada. Backend Node.js/Express con MongoDB. Autenticación basada en usuarios (client/coach).

**Arquitectura**:
```
┌─────────────────────┐         ┌──────────────────┐
│   FRONTEND          │         │   BACKEND        │
│  React Native       │◄───────►│   Node.js        │
│  (Expo)             │  REST   │   Express        │
└─────────────────────┘         └──────────────────┘
                                       │
                                       ▼
                                 ┌──────────────┐
                                 │  MongoDB     │
                                 │  (Cloud)     │
                                 └──────────────┘
```

---

## 🏗️ Estructura del Proyecto

```
/Universidad/app/
├── backend/                    # API REST (Node.js)
│   ├── server.js              # Entrada principal
│   ├── models/                # Schemas MongoDB
│   ├── routes/                # Endpoints
│   ├── .env                   # Variables
│   └── package.json
├── frontend/                  # App móvil (React Native)
│   ├── app/                   # Rutas (file-based)
│   ├── components/            # Componentes reutilizables
│   ├── constants/             # Tema, configuración
│   ├── hooks/                 # Custom hooks
│   ├── assets/                # Imágenes, logos
│   ├── .env                   # Variables
│   └── package.json
└── CONTEXTO_*.md              # Este documento y análisis
```

---

## 📡 URLs y Puertos

| Servicio | URL | Puerto |
|----------|-----|--------|
| Backend (Node) | `http://192.168.1.41:3000` | 3000 |
| API Auth | `http://192.168.1.41:3000/api/auth` | 3000 |
| API Chat | `http://192.168.1.41:3000/api/chat` | 3000 |
| News API | `http://192.168.1.41:8000/api` | 8000 |
| IA API | `http://192.168.1.41:8001/api` | 8001 |

---

## 🔐 Usuarios de Prueba

**Modelo de datos**:
```typescript
interface User {
  name: string (único)
  email: string (único)
  password: string (bcrypt, mín 6 caracteres)
  role: "client" | "coach"
  createdAt: Date
  updatedAt: Date
}
```

**Roles disponibles**:
- **client**: Usuario que invierte/recibe asesoría
- **coach**: Usuario que asesora/enseña

---

## 📱 Pantallas Principales

### Autenticación
- ✅ Login (email/password)
- ✅ Register (crear cuenta)
- ✅ Forgot Password (parcial)

### App Principal (Autenticada)
- ✅ **Home** (`/(app)/app.tsx`): Predicciones, tickers, noticias
- ✅ **Tickers** (`/(app)/tickers.tsx`): Listado de activos
- ✅ **Predicciones** (`/(app)/predictions.tsx`): Predicciones IA
- ✅ **Noticias** (`/(app)/news.tsx`): Noticias financieras
- ✅ **Perfil** (`/(app)/user.tsx`): Datos del usuario

### Navegación
- **Bottom Tab Navigation** (`components/options.tsx`):
  - 3 opciones de diseño disponibles
  - 5 tabs: Home, Tickers, IA, Noticias, Perfil
  - Indicadores visuales de estado activo

---

## 💾 Integración de Datos

### Flujo de Autenticación
```
1. Usuario ingresa email/password en login.tsx
   ↓
2. POST /api/auth/login → Backend
   ↓
3. Backend valida en MongoDB, devuelve userId
   ↓
4. Frontend guarda userId en AsyncStorage
   ↓
5. index.tsx verifica userId y redirige a /(app)
```

### Datos Actualmente
- ✅ **Usuarios**: Base de datos MongoDB
- ✅ **Chat**: Estructura preparada (modelos creados)
- ⚠️ **Tickers**: Datos mock (hardcoded)
- ⚠️ **Predicciones**: Datos mock (hardcoded)
- ⚠️ **Noticias**: Consumidas de API externa (8000)

---

## 🎨 Diseño y Tema

**Color Scheme** (basado en logo "IA Investing"):
- 🔵 Azul principal: `#00b4d8`
- 🟢 Verde secundario: `#4caf50`
- ⚫ Colores de error/warning: rojo/naranja

**Soporte**:
- ✅ Dark/Light mode automático (SO)
- ✅ React Native Paper (Material Design)
- ✅ Gradientes personalizados
- ✅ Iconos custom (SVG)

---

## 🛠️ Tecnologías Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5.2.1
- **BD**: MongoDB + Mongoose 9.2.1
- **Seguridad**: bcrypt 6.0.0
- **Middleware**: CORS, morgan (logging)
- **Config**: dotenv

### Frontend
- **Framework**: React 19.1.0 + React Native 0.81.5
- **Platform**: Expo 54.0.31
- **Router**: expo-router 6.0.21 (file-based)
- **UI**: react-native-paper 5.15.0
- **Lenguaje**: TypeScript 5.9.2
- **Storage**: AsyncStorage 2.2.0
- **Gráficos**: victory-native 41.20.2

---

## 📝 Próximos Pasos

1. **Completar Chat**:
   - Implementar endpoints completos
   - Crear mensajes en tiempo real
   - UI para chat en frontend

2. **Integrar APIs reales**:
   - Reemplazar datos mock de tickers
   - Conectar con APIs de predicciones
   - Actualizar noticias en tiempo real

3. **Autenticación mejorada**:
   - JWT tokens (ahora solo userId)
   - Refresh tokens
   - Session management

4. **Features adicionales**:
   - Perfil de usuario completo
   - Cartera de inversiones
   - Gráficos interactivos
   - Notificaciones push

---

## 👤 Usuario Actual

**Rol**: Desarrollador full-stack  
**Objetivo**: Expandir app con nuevas features  
**Stack conocido**: TypeScript, React Native, Node.js

---

## 📞 Contacto de Servicios

- **MongoDB Atlas**: Cloud instance activa
- **Base de datos**: `appName=TradingIA`
- **Zona horaria**: América (basado en IP 192.168.1.41)
