import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

import { RootStackParamList } from './src/navigation/types';
import { getAccessToken } from './src/api/tokenStore';
import { setSessionExpiredListener } from './src/api/client';

import RequestOtpScreen from './src/screens/RequestOtpScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import VehiclesListScreen from './src/screens/VehiclesListScreen';

// Keep the native splash screen on screen while we load fonts + check the
// login token. We hide it manually once everything is ready (see below).
// The .catch is just to silence a harmless warning during Fast Refresh.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // ---- 1. Load the Poppins font files into memory ----
  // useFonts returns [true] once every listed font is ready to use.
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  // ---- 2. Existing auth check ----
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = await getAccessToken();
      if (token) {
        setIsAuthenticated(true);
      }
      setAuthChecked(true);
    };

    checkAuthStatus();

    setSessionExpiredListener(() => {
      setIsAuthenticated(false);
    });
  }, []);

  // ---- 3. The app is ready only when BOTH are done ----
  const appIsReady = fontsLoaded && authChecked;

  // ---- 4. Hide the splash screen the moment the first screen has drawn ----
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // While not ready: render nothing. The native splash screen stays visible.
  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <>
              <Stack.Screen name="Home">
                {(props) => <HomeScreen {...props} onLogout={() => setIsAuthenticated(false)} />}
              </Stack.Screen>
              <Stack.Screen name="Profile">
                {(props) => <ProfileScreen {...props} onLogout={() => setIsAuthenticated(false)} />}
              </Stack.Screen>
              <Stack.Screen name="VehiclesList" component={VehiclesListScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="RequestOtp" component={RequestOtpScreen} />
              <Stack.Screen name="VerifyOtp">
                {(props) => (
                  <VerifyOtpScreen {...props} onLoginSuccess={() => setIsAuthenticated(true)} />
                )}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
