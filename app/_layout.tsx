import { initSentry } from "@/lib/sentry";
import { useSessionStore } from "@/store/useSessionStore";
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import './globals.css';

// Initialize Sentry before app renders
initSentry();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "QuickSand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
    "QuickSand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
    "QuickSand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
    "QuickSand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
    "QuickSand-Light": require("../assets/fonts/Quicksand-Light.ttf"),
  });

  const { checkSession, status } = useSessionStore();
  const router = useRouter();
  const segments = useSegments();

  // Handle deep links for password reset
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { hostname, path, queryParams } = Linking.parse(event.url);
      
      // Handle budgetapp://reset-password?userId=...&secret=...
      if (hostname === 'reset-password' || path === 'reset-password') {
        const userId = queryParams?.userId as string;
        const secret = queryParams?.secret as string;
        
        if (userId && secret) {
          router.push(`/reset-password?userId=${userId}&secret=${secret}`);
        }
      }
    };

    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkSession();
    }
  }, [fontsLoaded, error]);

  useEffect(() => {
    if (status === "loading" || status === "idle") return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "signup" || segments[0] === "forgot-password" || segments[0] === "reset-password";

    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/login");
    } else if (status === "authenticated" && inAuthGroup) {
      router.replace("/");
    }
  }, [status, segments]);

  return <Stack screenOptions={{ headerShown: false }}/>;
}
