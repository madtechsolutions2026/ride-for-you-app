import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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

import RequestOtpScreen from './src/screens/RequestOtpScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import VehiclesListScreen from './src/screens/VehiclesListScreen';
import BookingPaymentScreen from './src/screens/BookingPaymentScreen';
import BookingConfirmedScreen from './src/screens/BookingConfirmedScreen';
import MyBookingsScreen from './src/screens/MyBookingsScreen';

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
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            initialRouteName="BookingConfirmed"
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 180,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              freezeOnBlur: true,
            }}
          >
            <Stack.Screen
              name="BookingConfirmed"
              component={BookingConfirmedScreen}
              options={{ gestureEnabled: false }}
            />
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
            <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
            <Stack.Screen name="RequestOtp" component={RequestOtpScreen} />
            <Stack.Screen name="VerifyOtp">
              {(props) => (
                <VerifyOtpScreen {...props} onLoginSuccess={() => setIsAuthenticated(true)} />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
