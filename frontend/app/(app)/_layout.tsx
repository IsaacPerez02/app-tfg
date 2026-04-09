import { Stack } from 'expo-router';
import Options from '@/components/options';

export default function AppLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <Options />
    </>
  );
}