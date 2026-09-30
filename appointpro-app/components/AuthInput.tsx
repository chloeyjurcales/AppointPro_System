import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type AuthInputProps = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
};

export default function AuthInput({ icon, isPassword, ...rest }: AuthInputProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.container}>
      {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />}
      <TextInput
        style={styles.input}
        placeholderTextColor="#9B9B9B"
        secureTextEntry={isPassword ? hidden : false}
        autoCapitalize="none"
        {...rest}
      />
      {isPassword && (
        <TouchableOpacity onPress={() => setHidden(!hidden)}>
          <Ionicons
            name={hidden ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textDark,
  },
});