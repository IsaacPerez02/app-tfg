// app/(app)/_layout.tsx
import { Stack } from 'expo-router';
import Options from '@/components/options'; // ✅ Aquí sí

export default function AppLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <Options /> {/* ✅ Footer solo en la app autenticada */}
    </>
  );
}