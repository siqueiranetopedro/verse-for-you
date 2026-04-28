import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import JournalScreen from "@/screens/JournalScreen";
import { DonateHeaderButton } from "@/components/DonateHeaderButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type JournalStackParamList = {
  Journal: undefined;
};

const Stack = createNativeStackNavigator<JournalStackParamList>();

export default function JournalStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Journal"
        component={JournalScreen}
        options={{
          title: "Journal",
          headerRight: () => <DonateHeaderButton />,
        }}
      />
    </Stack.Navigator>
  );
}
