import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Hauteur du clavier en temps réel. Sur Android 15+ (edge-to-edge, Expo SDK
// 54), `adjustResize` ne redimensionne plus la fenêtre : KeyboardAvoidingView
// (behavior non défini sur Android) devient inopérant et le champ focusé reste
// sous le clavier — l'écran semble « gelé », on ne voit pas ce qu'on tape. On
// pousse donc le contenu au-dessus du clavier via un padding bas, quel que soit
// le mode fenêtre (fonctionne aussi dans Expo Go).
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const show = (e: { endCoordinates?: { height?: number } }) => {
      setInset(e.endCoordinates?.height ?? 0);
    };
    const hide = () => setInset(0);
    const subs = [
      Keyboard.addListener('keyboardWillShow', show),
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardWillHide', hide),
      Keyboard.addListener('keyboardDidHide', hide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return inset;
}