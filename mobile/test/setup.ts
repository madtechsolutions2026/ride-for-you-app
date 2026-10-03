jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Stub the icon font.
 *
 * @expo/vector-icons pulls in expo-font -> expo-asset, which is native-only and
 * not resolvable under jest. Nothing we test depends on an icon's glyph, only
 * on the labels and handlers around it, so a plain view is enough.
 */
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Icon = (props: Record<string, unknown>) =>
    React.createElement(View, { ...props, testID: props.testID ?? 'icon' });

  return new Proxy(
    { __esModule: true },
    {
      get: (target: Record<string, unknown>, key: string) =>
        key in target ? target[key] : Icon,
    },
  );
});
