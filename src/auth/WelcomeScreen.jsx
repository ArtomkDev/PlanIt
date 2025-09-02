import React from 'react'
import { View, Button, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'

export default function WelcomeScreen({ setGuest }) {  // ← ТУТ додаємо setGuest
  const navigation = useNavigation()

  return (
    <View style={styles.container}>
      <Button
        title="Увійти"
        onPress={() => navigation.navigate('SignIn')}
      />
      <Button
        title="Зареєструватися"
        onPress={() => navigation.navigate('SignUp')}
      />
      <Button
        title="Продовжити без акаунта"
        onPress={() => {
          setGuest(true)         // ← Тепер працює
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 }
})