import React from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

type ProfileAvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  role?: 'student' | 'faculty';
};

function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfileAvatar({ uri, name, size = 44, style, role }: ProfileAvatarProps) {
  const background = role === 'faculty' ? colors.primary : colors.primary;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(11, size * 0.34) }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: colors.white, fontWeight: '800' },
});
