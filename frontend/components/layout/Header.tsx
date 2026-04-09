import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        borderBottomColor: isDark ? '#222222' : '#E0E0E0',
      }
    ]}>
      <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: isDark ? '#CCCCCC' : '#666666' }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
});
