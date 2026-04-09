# 📱 CONTEXTO FRONTEND

**Ubicación**: `/frontend`  
**Framework**: React Native (Expo)  
**Lenguaje**: TypeScript  
**Versión Expo**: 54.0.31  
**Versión React**: 19.1.0  
**Routing**: expo-router 6.0.21 (file-based)  

---

## 📂 Estructura de Archivos

```
frontend/
├── app/                               # Rutas (file-based routing)
│   ├── index.tsx                      # Splash/Auth check
│   ├── _layout.tsx                    # Root layout + theme
│   ├── modal.tsx                      # Modal (legacy)
│   ├── (auth)/                        # Rutas de autenticación (sin header)
│   │   ├── _layout.tsx
│   │   ├── login.tsx                  # Pantalla login
│   │   ├── register.tsx               # Pantalla registro
│   │   └── forgot-password.tsx        # Recuperación contraseña (parcial)
│   ├── (app)/                         # Rutas autenticadas (con header)
│   │   ├── _layout.tsx                # Stack layout + bottom nav
│   │   ├── app.tsx                    # Home principal
│   │   ├── (news)/
│   │   │   └── news.tsx               # Pantalla de noticias
│   │   ├── (predictions)/
│   │   │   └── predictions.tsx        # Predicciones IA
│   │   ├── (tickers)/
│   │   │   └── tickers.tsx            # Listado tickers/activos
│   │   └── (user)/
│   │       └── user.tsx               # Perfil de usuario
│   └── (tabs)/                        # Rutas legacy (no usadas)
│       ├── _layout.tsx
│       ├── index.tsx
│       └── explore.tsx
├── components/
│   ├── options.tsx                    # Bottom navigation (3 diseños)
│   └── svg/                           # Iconos SVG custom
│       ├── home.tsx
│       ├── rocket.tsx
│       ├── trending.tsx
│       ├── news.tsx
│       ├── user.tsx
│       └── dots.tsx
├── constants/
│   └── theme.ts                       # Colores, tipografía, spacing
├── hooks/
│   ├── use-color-scheme.ts            # Detecta dark/light SO
│   ├── use-color-scheme.web.ts        # Versión web
│   └── use-theme-color.ts             # Hook del tema
├── assets/
│   └── app/
│       └── logo/
│           └── logo.png
├── scripts/
│   └── reset-project.js               # Script reset template
├── tsconfig.json                      # Configuración TypeScript
├── eslint.config.js                   # ESLint rules
├── package.json                       # Dependencias
├── expo-env.d.ts                      # Tipos Expo generados
├── app.json                           # Config Expo
├── .env                               # Variables entorno
└── .gitignore
```

---

## 🔐 Flujo de Autenticación

### Punto Entrada: app/index.tsx

```typescript
// 1. Al abrir la app
export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    // 2. Lee AsyncStorage buscando 'userId'
    AsyncStorage.getItem('userId').then((token) => {
      setUserToken(token);
      setIsLoading(false);
    });
  }, []);

  // 3. Si existe userId → redirige a /(app)/app
  // 4. Si NO existe → redirige a /(auth)/login
  return userToken ? (
    <Redirect href="/(app)/app" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
```

---

## 🎨 Root Layout: app/_layout.tsx

```typescript
// Configura:
// 1. Dark/Light mode (auto detectado)
// 2. Navegación Stack
// 3. Tema de React Navigation
// 4. StatusBar

// Rutas principales:
// - index (splash/auth check)
// - (app) (grupo autenticado)
// - (auth) (grupo sin auth)
```

---

## 🔑 Rutas de Autenticación

### 1. Login: app/(auth)/login.tsx

```typescript
interface LoginForm {
  email: string;
  password: string;
}

// Funcionalidad:
// 1. Inputs: Email, Password
// 2. Botón: "Inicia Sesión"
// 3. Enlace: "¿Olvidaste contraseña?"
// 4. Enlace: "Crear cuenta"
// 5. Logo de la app

// Request:
POST /api/auth/login
{
  "email": "juan@example.com",
  "password": "password123"
}

// Response:
{
  "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "role": "client"
}

// Almacenamiento:
AsyncStorage.setItem('userId', userId)

// Redirección:
→ /(app)/app
```

**Validaciones**:
- ✅ Email no vacío
- ✅ Password no vacío
- ✅ Email válido (regex)
- ❌ Confirmación de email
- ❌ CAPTCHA

**Tema**: ✅ Dark/Light automático

---

### 2. Registro: app/(auth)/register.tsx

```typescript
interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: "client" | "coach";
}

// Request:
POST /api/auth/register
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123",
  "role": "client"
}

// Response:
{
  "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "role": "client"
}

// Almacenamiento:
AsyncStorage.setItem('userId', userId)

// Redirección:
→ /(app)/app
```

**Validaciones**:
- ✅ Nombre no vacío
- ✅ Email válido
- ✅ Password mínimo 6 caracteres
- ✅ Passwords coinciden
- ❌ Nombre único (validación lado servidor)
- ❌ Email único (validación lado servidor)

---

### 3. Forgot Password: app/(auth)/forgot-password.tsx

**Estado**: Parcialmente implementado  
**Funcionalidad**: Form de email (sin backend aún)

---

## 🏠 App Principal Autenticada

### Layout: app/(app)/_layout.tsx

```typescript
// Stack Navigator sin header
// Renderiza componente <Options /> (bottom navigation)
// Las 5 tabs:
// 1. Home (app)
// 2. Tickers (tickers)
// 3. Predicciones/IA (predictions)
// 4. Noticias (news)
// 5. Perfil (user)
```

---

### Home Screen: app/(app)/app.tsx

```
┌─────────────────────────────┐
│  IA Investing (Gradiente)   │  ← Header con logo
│                             │
│ ┌───────────────────────┐   │
│ │ Predicción +3.2% 📈   │   │  ← Badge renderizado
│ └───────────────────────┘   │
│                             │
│ TICKERS DESTACADOS:         │
│ ┌─────────┐ ┌─────────┐    │
│ │ BTC/USD │ │ ETH/USD │ ...│  ← Scroll horizontal
│ │ $45,234 │ │ $2,456  │    │
│ │ ↑ 2.3%  │ │ ↓ -1.2% │    │
│ └─────────┘ └─────────┘    │
│                             │
│ NOTICIAS DEL MERCADO:       │
│ ┌─────────────────────────┐ │
│ │ "Bitcoin alcanza nuevo" │ │  ← Scroll horizontal
│ │ "La Fed anuncia..."     │ │
│ │ "Análisis del día"      │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ [🏠] [📊] [🚀] [📰] [👤]   │  ← Bottom tabs
└─────────────────────────────┘
```

**Datos**: Mock/hardcoded actualmente

**Componentes**:
```typescript
interface TickerItem {
  symbol: string;
  price: number;
  change1d: number;
  change7d: number;
  color: string;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
}
```

---

### Tickers: app/(app)/(tickers)/tickers.tsx

Listado de activos financieros.  
**Datos**: Mock  
**Funcionalidad**: Scroll vertical

---

### Predicciones IA: app/(app)/(predictions)/predictions.tsx

Predicciones de inversión generadas por IA.  
**Datos**: Mock  
**Referencia API**: `http://192.168.1.41:8001/api`

---

### Noticias: app/(app)/(news)/news.tsx

Noticias financieras.  
**API Externa**: `http://192.168.1.41:8000/api`  
**Datos**: Consumidas de servicio externo

---

### Perfil: app/(app)/(user)/user.tsx

Datos y opciones del usuario.  
**Funcionalidad**:
- Mostrar nombre, email
- Mostrar role (client/coach)
- Opción logout (borrar userId de AsyncStorage)
- Editar perfil (no implementado)

---

## 🧭 Componentes Reutilizables

### Bottom Navigation: components/options.tsx

**3 Diseños disponibles**:

#### 1. OptionsMinimal
```
┌─────────────────┐
│ ───────●────── │  ← Indicador superior
│ [🏠] [📊] [...] │
```

#### 2. OptionsFloating (EXPORTADO POR DEFECTO)
```
┌──────────────────────────────┐
│ [🏠] [📊] [🚀] [📰] [👤]    │  ← Botones redondeados
│ con gradiente, espaciados    │
└──────────────────────────────┘
```

#### 3. OptionsIsland
```
┌──────────────────────────────┐
│   [🏠] [📊]  [🚀]  [📰] [👤] │  ← Isla flotante
│      indicador central       │
└──────────────────────────────┘
```

**Props**:
```typescript
interface OptionsProps {
  active: string;  // nombre de ruta activa
  onPress: (route: string) => void;
}
```

---

## 🎨 Tema: constants/theme.ts

### Colores

```typescript
export const colors = {
  light: {
    primary: '#00b4d8',      // Azul principal
    secondary: '#4caf50',    // Verde
    background: '#ffffff',
    text: '#000000',
    border: '#e0e0e0',
    error: '#f44336',
  },
  dark: {
    primary: '#00b4d8',
    secondary: '#4caf50',
    background: '#121212',
    text: '#ffffff',
    border: '#333333',
    error: '#ff6b6b',
  }
};
```

### Tipografía (por plataforma)

```typescript
export const typography = {
  ios: { },
  android: { },
  web: { },
  
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }
};
```

### Spacing

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
};
```

### Border Radius

```typescript
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
```

---

## 🪝 Hooks Personalizados

### useColorScheme

```typescript
// Detecta automáticamente dark/light mode del SO
import { useColorScheme } from '@/hooks/use-color-scheme';

function MyComponent() {
  const colorScheme = useColorScheme();  // 'light' | 'dark'
  
  return (
    <View style={{
      backgroundColor: colorScheme === 'dark' ? '#000' : '#fff'
    }}>
      {/* contenido */}
    </View>
  );
}
```

**Versión Web**: Archivo separado `use-color-scheme.web.ts`

---

### useThemeColor

```typescript
// Hook personalizado para aplicar tema
import { useThemeColor } from '@/hooks/use-theme-color';

function MyComponent() {
  const color = useThemeColor('primary');  // '#00b4d8'
  
  return <Text style={{ color }}>{/* texto */}</Text>;
}
```

---

## 📦 Dependencias Principales

```json
{
  "react": "^19.1.0",
  "react-native": "^0.81.5",
  "expo": "~54.0.31",
  "expo-router": "~6.0.21",
  "react-native-paper": "^5.15.0",
  "react-native-reanimated": "~4.1.1",
  "expo-linear-gradient": "~15.0.8",
  "@react-navigation/native": "^7.1.8",
  "@react-navigation/bottom-tabs": "^7.4.0",
  "@react-native-async-storage/async-storage": "^2.2.0",
  "victory-native": "^41.20.2",
  "react-native-svg": "^15.15.3",
  "typescript": "~5.9.2"
}
```

---

## 🔌 Variables de Entorno (.env)

```bash
EXPO_PUBLIC_API=http://192.168.1.41:3000/api
EXPO_PUBLIC_API_NEWS=http://192.168.1.41:8000/api
EXPO_PUBLIC_API_IA=http://192.168.1.41:8001/api
```

**Nota**: Variables prefijadas con `EXPO_PUBLIC_` son accesibles desde el código.

---

## 📡 Integración con Backend

### Llamadas HTTP

**Login Example**:
```typescript
const response = await fetch(
  `${process.env.EXPO_PUBLIC_API}/auth/login`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  }
);
const data = await response.json();
// data: { userId, role }
```

### Storage Local

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Guardar userId
await AsyncStorage.setItem('userId', userId);

// Leer userId
const userId = await AsyncStorage.getItem('userId');

// Borrar userId (logout)
await AsyncStorage.removeItem('userId');
```

---

## 🚀 Scripts npm

```json
{
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "eslint ."
}
```

---

## ⚙️ Configuración TypeScript

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]  // Alias para imports
    }
  }
}
```

**Uso**: `import { useColorScheme } from '@/hooks/use-color-scheme'`

---

## 📊 Estado Actual

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| Login/Register | ✅ Funcional | Alta |
| Auth Flow | ✅ Funcional | Alta |
| Home Screen | ✅ Datos mock | Media |
| Bottom Navigation | ✅ 3 opciones | Media |
| Dark/Light Mode | ✅ Automático | Baja |
| Tickers | ⚠️ Mock data | Alta |
| Noticias | ⚠️ API externa | Media |
| Predicciones | ⚠️ Mock data | Alta |
| Perfil | ⚠️ Básico | Media |
| Chat UI | ❌ No existe | Baja |
| Logout | ❌ No implementado | Media |

---

## 🐛 Problemas Conocidos

1. **Datos mock en Home**: Los tickers, noticias y predicciones son hardcoded
2. **Sin logout**: No hay botón para cerrar sesión
3. **Chat UI falta**: Pantalla de chat no implementada
4. **Sin persistencia de datos**: Solo guarda userId
5. **Sin validación backend**: Login/Register no valida correctamente

---

## 💡 Roadmap

1. Reemplazar datos mock con API real
2. Implementar logout con confirmación
3. Crear pantalla de chat
4. Agregar gráficos interactivos
5. Implementar notificaciones push
6. Agregar perfil de usuario completo
7. Sincronización en tiempo real (WebSocket)
