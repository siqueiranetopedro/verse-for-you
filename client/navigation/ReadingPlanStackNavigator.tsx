import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReadingPlanScreen from "@/screens/ReadingPlanScreen";
import { DonateHeaderButton } from "@/components/DonateHeaderButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ReadingPlanStackParamList = {
  ReadingPlan: undefined;
};

const Stack = createNativeStackNavigator<ReadingPlanStackParamList>();

export default function ReadingPlanStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ReadingPlan"
        component={ReadingPlanScreen}
        options={{
          title: "Reading Plans",
          headerRight: () => <DonateHeaderButton />,
        }}
      />
    </Stack.Navigator>
  );
}
