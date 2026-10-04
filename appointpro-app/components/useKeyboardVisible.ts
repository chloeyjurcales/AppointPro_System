import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True while the soft keyboard is on screen. The bottom tab bars use this to
 * step aside while the user is typing and, just as importantly, to come back
 * deterministically when the keyboard closes (instead of depending on a
 * KeyboardAvoidingView resizing its way back to the right height).
 */
export default function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    // Sync in case the keyboard was already open when this mounted.
    setVisible(Keyboard.isVisible());
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
