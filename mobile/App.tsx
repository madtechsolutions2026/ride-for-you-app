import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { RootStackParamList } from './src/navigation/types';
import { getAccessToken } from './src/api/tokenStore';
import { setSessionExpiredListener } from './src/api/client';

import RequestOtpScreen from './src/screens/RequestOtpScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if the user is already logged in on startup
    const checkAuthStatus = async () => {
      const token = await getAccessToken();
      if (token) {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuthStatus();

    // Set up a listener for session expirations (e.g. invalid tokens or explicit logout)
    setSessionExpiredListener(() => {
      setIsAuthenticated(false);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          // App Stack (Authenticated Users)
          <Stack.Screen name="Home">
            {(props) => (
              <HomeScreen 
                {...props} 
                onLogout={() => setIsAuthenticated(false)} 
              />
            )}
          </Stack.Screen>
        ) : (
          // Auth Stack (Unauthenticated Users)
          <>
            <Stack.Screen name="RequestOtp" component={RequestOtpScreen} />
            <Stack.Screen name="VerifyOtp">
              {(props) => (
                <VerifyOtpScreen 
                  {...props} 
                  onLoginSuccess={() => setIsAuthenticated(true)} 
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
