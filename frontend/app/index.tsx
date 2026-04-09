import { useEffect } from "react";
import { useRouter, useNavigation } from "expo-router";

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
    const router = useRouter();

    const checkAuthStatus = async () => {
        try {
            const userId = await AsyncStorage.getItem("userId");
            if (userId) {
                router.replace("/(app)/app");
            } else {
                router.replace("/(auth)/login");
            }
        } catch (err) {
            console.log(err)
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    return null;
}
