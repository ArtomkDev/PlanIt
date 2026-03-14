import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  Keyboard,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const IS_IOS = Platform.OS === "ios";

const BottomSheet = forwardRef(({ 
  onClose, 
  children, 
  header, 
  backgroundColor = "#fff", 
  handleColor = "#ccc" 
}, ref) => {
  const panY = useRef(new Animated.Value(IS_IOS ? 0 : SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!IS_IOS) {
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== "web",
        damping: 20,
        stiffness: 90,
        mass: 1,
      }).start();
    }
  }, []);

  const closeWithAnimation = () => {
    Keyboard.dismiss();
    if (IS_IOS) {
      onClose();
    } else {
      Animated.timing(panY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => onClose());
    }
  };

  useImperativeHandle(ref, () => ({
    close: closeWithAnimation,
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (IS_IOS) return false;
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        panY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (IS_IOS) return;
        let newY = gestureState.dy;
        // Apply friction when pulling upwards beyond the top boundary
        if (newY < 0) {
          newY = -Math.pow(Math.abs(newY), 0.8);
        }
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (IS_IOS) return;
        if (gestureState.dy > 120 || (gestureState.vy > 0.5 && gestureState.dy > 40)) {
          closeWithAnimation();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== "web",
            bounciness: 6,
            speed: 14,
          }).start();
        }
      },
    })
  ).current;

  return (
    <KeyboardAvoidingView behavior={IS_IOS ? "padding" : "height"} style={styles.overlay}>
      {!IS_IOS && <Pressable onPress={closeWithAnimation} style={styles.backdrop} />}

      <Animated.View
        style={[
          styles.sheetContainer,
          { backgroundColor },
          !IS_IOS && { transform: [{ translateY: panY }] },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: handleColor }]} />
          </View>
          {header}
        </View>

        <View style={styles.contentContainer}>
          {children}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: "flex-end" 
  },
  backdrop: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: "rgba(0,0,0,0.5)" 
  },
  sheetContainer: {
    flex: 1,
    marginTop: IS_IOS ? 0 : "10%",
    borderTopLeftRadius: IS_IOS ? 0 : 20,
    borderTopRightRadius: IS_IOS ? 0 : 20,
    overflow: "hidden",
    elevation: 10,
    ...Platform.select({
      web: { boxShadow: "0px -5px 10px rgba(0,0,0,0.3)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
    }),
  },
  dragZone: { 
    backgroundColor: "transparent", 
    paddingTop: 10 
  },
  handleContainer: { 
    alignItems: "center", 
    paddingBottom: 10 
  },
  handle: { 
    width: 40, 
    height: 5, 
    borderRadius: 3, 
    opacity: 0.5 
  },
  contentContainer: { 
    flex: 1 
  },
});

export default BottomSheet;