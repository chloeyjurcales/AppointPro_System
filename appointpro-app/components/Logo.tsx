import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../theme';

type LogoProps = {
  size?: 'large' | 'small';
};

export default function Logo({ size = 'large' }: LogoProps) {
  return (
    <View style={styles.row}>
      <FontAwesome5
        name="graduation-cap"
        size={size === 'large' ? 30 : 26}
        color={colors.primary}
      />
      <View style={styles.divider} />
      <Text style={[styles.title, size === 'small' && styles.titleSmall]}>
        AppointPro
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: '#D1D1D1',
    marginHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textDark,
  },
  titleSmall: {
    fontSize: 20,
  },
});