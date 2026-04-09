# 🔧 CONTEXTO BACKEND

**Ubicación**: `/backend`  
**Lenguaje**: JavaScript (Node.js)  
**Framework**: Express.js 5.2.1  
**Base de datos**: MongoDB (Mongoose)  
**Puerto**: 3000

---

## 📂 Estructura

```
backend/
├── server.js                  # Punto entrada, middleware setup
├── models/                    # Esquemas MongoDB
│   ├── User.js               # Usuario con autenticación
│   ├── Chat.js               # Conversaciones (referenciado)
│   └── Message.js            # Mensajes (referenciado)
├── routes/                    # Controladores API
│   ├── auth.js               # Login/Register
│   └── chat.js               # Chat CRUD
├── .env                       # Variables de entorno
├── package.json              # Dependencias
└── .gitignore
```

---

## 🚀 Punto de Entrada: server.js

```javascript
// Puerto configurado desde .env o 3000 por defecto
const PORT = process.env.PORT || 3000;

// Conexión a MongoDB via Mongoose
// URL: mongodb+srv://Isaac:N97beS5gXp9Bieyd@tradingia.gc6ykmg.mongodb.net/?appName=TradingIA

// Middlewares:
app.use(cors());           // CORS habilitado
app.use(express.json());   // Body parser JSON

// Rutas registradas:
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Listen en puerto 3000
```

---

## 👤 Modelo: User

**Archivo**: `models/User.js`

```javascript
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true           // No puede haber 2 usuarios con mismo nombre
  },
  email: {
    type: String,
    required: true,
    unique: true           // No puede haber 2 emails iguales
  },
  password: {
    type: String,
    required: true,
    minlength: 6           // Mínimo 6 caracteres
  },
  role: {
    type: String,
    enum: ['client', 'coach'],
    default: 'client'
  },
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });
```

### Métodos:
```javascript
// Pre-save hook: hashea password automáticamente
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método de instancia: compara contraseña
userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.password);
};
```

---

## 🔑 Rutas de Autenticación

**Archivo**: `routes/auth.js`

### 1. POST `/api/auth/register`
Crea un nuevo usuario.

**Request**:
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123",
  "role": "client"  // opcional, default "client"
}
```

**Response** (201 Created):
```json
{
  "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "role": "client",
  "createdAt": "2026-04-07T10:30:00.000Z",
  "updatedAt": "2026-04-07T10:30:00.000Z"
}
```

**Validaciones**:
- `name`: Requerido, único en BD
- `email`: Requerido, único en BD
- `password`: Mínimo 6 caracteres
- `role`: "client" o "coach" (default "client")

**Errores**:
- 400: Campos faltantes o contraseña < 6 caracteres
- 409: Email o nombre ya registrado

---

### 2. POST `/api/auth/login`
Autentica usuario y devuelve ID.

**Request**:
```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "role": "client"
}
```

**Validaciones**:
- Email existe en BD
- Contraseña coincide (comparación bcrypt)

**Errores**:
- 400: Email o password ausentes
- 401: Credenciales inválidas

---

## 💬 Modelo: Chat

**Archivo**: `models/Chat.js` (referenciado, estructura preparada)

```javascript
// Estructura esperada (no completamente implementada)
const chatSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'User' },
  coachId: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });
```

---

## 💬 Modelo: Message

**Archivo**: `models/Message.js` (referenciado, estructura preparada)

```javascript
// Estructura esperada (no completamente implementada)
const messageSchema = new Schema({
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
  senderId: { type: Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });
```

---

## 💬 Rutas de Chat

**Archivo**: `routes/chat.js`

### 1. GET `/api/chat/chats`
Obtiene todos los chats del usuario autenticado.

**Query Parameters**:
```
GET /api/chat/chats?userId=65a1b2c3d4e5f6g7h8i9j0k1
```

**Response** (200 OK):
```json
{
  "chats": [
    {
      "_id": "chat_1",
      "clientId": "user_1",
      "coachId": "user_2",
      "isDeleted": false,
      "createdAt": "2026-04-01T12:00:00.000Z",
      "updatedAt": "2026-04-07T15:30:00.000Z"
    }
  ]
}
```

**Lógica**: Devuelve chats donde usuario es client o coach y `isDeleted != true`

---

### 2. POST `/api/chat/new`
Crea un nuevo chat entre client y coach.

**Request**:
```json
{
  "clientId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "coachId": "65a1b2c3d4e5f6g7h8i9j0k2"
}
```

**Response** (201 Created):
```json
{
  "_id": "chat_1",
  "clientId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "coachId": "65a1b2c3d4e5f6g7h8i9j0k2",
  "isDeleted": false,
  "createdAt": "2026-04-07T15:45:00.000Z",
  "updatedAt": "2026-04-07T15:45:00.000Z"
}
```

---

### 3. PUT `/api/chat/delete`
Marca un chat como eliminado (soft delete, no lo borra).

**Request**:
```json
{
  "chatId": "chat_1"
}
```

**Response** (200 OK):
```json
{
  "message": "Chat deleted",
  "chat": {
    "_id": "chat_1",
    "isDeleted": true,
    "updatedAt": "2026-04-07T15:50:00.000Z"
  }
}
```

---

## 📦 Dependencias Principales

```json
{
  "express": "^5.2.1",          // Framework web
  "mongoose": "^9.2.1",         // ODM para MongoDB
  "bcrypt": "^6.0.0",           // Hashing de contraseñas
  "cors": "^2.8.6",             // CORS para requests
  "morgan": "^1.10.1",          // Logging HTTP
  "dotenv": "^17.3.1"           // Variables de entorno
}
```

---

## 🔐 Variables de Entorno (.env)

```bash
MONGODB_URI=mongodb+srv://Isaac:N97beS5gXp9Bieyd@tradingia.gc6ykmg.mongodb.net/?appName=TradingIA
PORT=3000
```

---

## 🔌 Seguridad Implementada

✅ **Hashing de Contraseñas**: bcrypt con salt=10  
✅ **CORS Habilitado**: Para requests desde frontend  
✅ **Validation**: Campos requeridos en register/login  
✅ **Unique Constraints**: Email y name no duplicables  

❌ **No Implementado**:
- JWT tokens (ahora solo userId en response)
- Rate limiting
- Validación de email
- 2FA

---

## 🧪 Testing Manual

### 1. Register
```bash
curl -X POST http://192.168.1.41:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test User",
    "email":"test@example.com",
    "password":"password123",
    "role":"client"
  }'
```

### 2. Login
```bash
curl -X POST http://192.168.1.41:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password123"
  }'
```

### 3. Get Chats
```bash
curl "http://192.168.1.41:3000/api/chat/chats?userId=65a1b2c3d4e5f6g7h8i9j0k1"
```

### 4. Create Chat
```bash
curl -X POST http://192.168.1.41:3000/api/chat/new \
  -H "Content-Type: application/json" \
  -d '{
    "clientId":"client_id_here",
    "coachId":"coach_id_here"
  }'
```

---

## 🚀 Scripts npm

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js"  // Si tienes nodemon instalado
}
```

---

## 📊 Estado Actual

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| User Auth | ✅ Completo | Alta |
| Chat CRUD | ⚠️ Parcial (sin Messages) | Alta |
| JWT Tokens | ❌ No implementado | Media |
| Rate Limiting | ❌ No implementado | Baja |
| Email Validation | ❌ No implementado | Media |
| Refresh Tokens | ❌ No implementado | Media |

---

## 🐛 Problemas Conocidos

1. **No hay autenticación JWT**: Solo devuelve userId en login
2. **Chat sin mensajes**: Modelo creado pero no rutas completas
3. **Sin validación de email**: No se valida que sea email válido
4. **Sin soft delete en Auth**: Si borras usuario, se pierde todo

---

## 💡 Roadmap Técnico

1. Implementar JWT + Refresh tokens
2. Completar CRUD de mensajes
3. Agregar validación de email
4. Implementar rate limiting
5. Agregar logger más robusto
6. Tests unitarios
