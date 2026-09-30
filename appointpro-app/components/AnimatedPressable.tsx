import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  /**
   * Plain style object/array only — unlike Pressable's own `style`, this
   * does NOT support the `(state) => style` function form, since the
   * style has to be merged with the animated transform up front.
   */
  style?: StyleProp<ViewStyle>;
  /** How far it scales down on press. Default 0.94 (subtle). */
  scaleTo?: number;
};

/**
 * Drop-in replacement for TouchableOpacity/Pressable that adds a quick,
 * consistent "press" scale animation (spring back on release) instead of
 * relying only on opacity change. Animates the Pressable node itself
 * (via Animated.createAnimatedComponent) so it stays a single flex child —
 * safe to use anywhere a TouchableOpacity was used, including inside
 * flexDirection: 'row' bars where each item needs flex: 1.
 * Uses the core Animated API, so it needs no extra native dependencies.
 */
export default function AnimatedPressable({
  style,
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn: PressableProps['onPressIn'] = (e) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps['onPressOut'] = (e) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      style={[style, { transform: [{ scale }] }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}