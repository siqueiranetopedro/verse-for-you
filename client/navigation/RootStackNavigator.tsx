import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import VerseDetailModal from "@/screens/VerseDetailModal";
import DonateScreen from "@/screens/DonateScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  VerseDetail: {
    verse: string;
    reference: string;
    emotion: string;
    isSaved: boolean;
    translation?: string;
  };
  Donate: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VerseDetail"
        component={VerseDetailModal}
        options={{
          presentation: "modal",
          headerTitle: "Verse",
        }}
      />
      <Stack.Screen
        name="Donate"
        component={DonateScreen}
        options={{
          headerTitle: "Support",
        }}
      />
    </Stack.Navigator>
  );
}
