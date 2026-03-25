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
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(panY, {
      toValue: 0,
      useNativeDriver: Platform.OS !== "web",
      damping: 20,
      stiffness: 90,
      mass: 1,
    }).start();
  }, []);

  const closeWithAnimation = () => {
    Keyboard.dismiss();
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onClose());
  };

  useImperativeHandle(ref, () => ({
    close: closeWithAnimation,
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, 
      
      onStartShouldSetPanResponderCapture: () => false, 

      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },

      onPanResponderGrant: () => {
        panY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        let newY = gestureState.dy;
        if (newY < 0) {
          newY = -Math.pow(Math.abs(newY), 0.8);
        }
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
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
      <Pressable onPress={closeWithAnimation} style={styles.backdrop} />

      <Animated.View
        style={[
          styles.sheetContainer,
          { backgroundColor },
          { transform: [{ translateY: panY }] },
        ]}
      >
        <View 
            {...panResponder.panHandlers} 
            style={[styles.dragZone, { backgroundColor }]} 
            collapsable={false}
        >
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: handleColor }]} />
          </View>
          
          <View pointerEvents="box-none">
            {header}
          </View>
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
    marginTop: "10%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingTop: 10,
    zIndex: 10,
  },
  handleContainer: { 
    alignItems: "center", 
    paddingBottom: 15,
    paddingTop: 5,
  },
  handle: { 
    width: 45, 
    height: 6, 
    borderRadius: 3, 
    opacity: 0.5 
  },
  contentContainer: { 
    flex: 1 
  },
});

export default BottomSheet;