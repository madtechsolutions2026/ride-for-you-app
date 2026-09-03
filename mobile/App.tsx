import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { registerForPush, attachPushHandlers } from './src/api/push';

import RequestOtpScreen from './src/screens/RequestOtpScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import VehiclesListScreen from './src/screens/VehiclesListScreen';
import BookingPaymentScreen from './src/screens/BookingPaymentScreen';
import BookingConfirmedScreen from './src/screens/BookingConfirmedScreen';
import MyBookingsScreen from './src/screens/MyBookingsScreen';
import MyRentalScreen from './src/screens/MyRentalScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navRef = useNavigationContainerRef<RootStackParamList>();

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

  // Push registration needs a session, so it waits for auth. Tapping a
  // notification deep-links to whatever screen the payload names.
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPush();
    return attachPushHandlers((data) => {
      const screen = data?.screen as keyof RootStackParamList | undefined;
      if (screen && navRef.isReady()) {
        // Params vary per screen and the payload is server-authored, so the
        // route name can't be proved at compile time here.
        const go = navRef.navigate as unknown as (s: string, p?: object) => void;
        go(screen, data?.params);
      }
    });
  }, [isAuthenticated]);

  const appIsReady = fontsLoaded && authChecked;

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <NavigationContainer ref={navRef}>
          <StatusBar style="dark" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 180,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              freezeOnBlur: true,
            }}
          >
            {isAuthenticated ? (
              <>
                <Stack.Screen name="Home">
                  {(props) => <HomeScreen {...props} onLogout={() => setIsAuthenticated(false)} />}
                </Stack.Screen>
                <Stack.Screen name="Profile">
                  {(props) => (
                    <ProfileScreen {...props} onLogout={() => setIsAuthenticated(false)} />
                  )}
                </Stack.Screen>
                <Stack.Screen name="VehiclesList" component={VehiclesListScreen} />
                <Stack.Screen name="BookingPayment" component={BookingPaymentScreen} />
                <Stack.Screen
                  name="BookingConfirmed"
                  component={BookingConfirmedScreen}
                  options={{ gestureEnabled: false }}
                />
                <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
                <Stack.Screen name="MyRental" component={MyRentalScreen} />
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
    </SafeAreaProvider>
  );
}
