import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GRADIENTS = [
  ['#FF416C', '#FF4B2B'], ['#36D1DC', '#5B86E5'], ['#FDC830', '#F37335'],
  ['#8E2DE2', '#4A00E0'], ['#00b09b', '#96c93d'], ['#ec008c', '#fc6767'],
  ['#1FA2FF', '#12D8FA'], ['#f12711', '#f5af19'], ['#654ea3', '#eaafc8'],
  ['#11998e', '#38ef7d'], ['#ff9966', '#ff5e62'], ['#7F00FF', '#E100FF'],
  ['#00C9FF', '#92FE9D'], ['#FC466B', '#3F5EFB'], ['#83a4d4', '#b6fbff'], 
  ['#9CECFB', '#65C7F7'], ['#0052D4', '#4364F7'], ['#56B4D3', '#348AC7'], 
  ['#114357', '#F29492'], ['#FF512F', '#DD2476'], ['#FF5F6D', '#FFC371'], 
  ['#16A085', '#F4D03F'], ['#DCE35B', '#45B649'], ['#e65c00', '#F9D423'], 
  ['#ED213A', '#93291E'], ['#000000', '#e74c3c'], ['#DA4453', '#89216B'], 
  ['#a8c0ff', '#3f2b96'], ['#4CB8C4', '#3CD3AD'], ['#1A2980', '#26D0CE'], 
  ['#FF0099', '#493240'], ['#8E0E00', '#1F1C18'], ['#ee0979', '#ff6a00'],
  ['#F09819', '#EDDE5D'], ['#8A2387', '#E94057'], ['#2193b0', '#6dd5ed']
];

const ANGLES = [
  { id: 'tl-br', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  { id: 'tr-bl', start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  { id: 'bl-tr', start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  { id: 'br-tl', start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
  { id: 't-b',   start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  { id: 'l-r',   start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
];

class BagRandomizer {
  constructor(items, idKey = null) {
    this.items = items;
    this.idKey = idKey;
    this.bag = [];
    this.last = null;
  }

  next() {
    if (this.bag.length === 0) {
      let newBag = [...this.items];
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
      }

      if (this.last) {
        const isSame = this.idKey 
          ? newBag[0][this.idKey] === this.last[this.idKey] 
          : newBag[0] === this.last;
          
        if (isSame && newBag.length > 1) {
          [newBag[0], newBag[1]] = [newBag[1], newBag[0]];
        }
      }
      this.bag = newBag;
    }

    const item = this.bag.shift();
    this.last = item;
    return item;
  }
}

const MorphingLoader = ({ size = 60, style }) => {
  const s = size / 2;

  const SHAPES = [
    { id: 'star',          tl: 0, tr: 0, br: 0, bl: 0, r1: 0, r2: 45 },
    { id: 'circle',        tl: s, tr: s, br: s, bl: s, r1: 0, r2: 0 },
    { id: 'flower',        tl: 0, tr: s, br: 0, bl: s, r1: 0, r2: 90 },
    { id: 'leaf',          tl: s, tr: 0, br: s, bl: 0, r1: 0, r2: 90 },
    { id: 'rounded_sq',    tl: 15, tr: 15, br: 15, bl: 15, r1: 0, r2: 0 },
    { id: 'octagon',       tl: 15, tr: 15, br: 15, bl: 15, r1: 0, r2: 45 },
    { id: 'drop',          tl: 0, tr: s, br: s, bl: s, r1: 0, r2: 0 },
    { id: 'shuriken',      tl: 0, tr: s, br: 0, bl: s, r1: 0, r2: 45 },
    { id: 'shield',        tl: 0, tr: 0, br: s, bl: s, r1: 0, r2: 0 },
    { id: 'butterfly',     tl: s, tr: 0, br: s, bl: 0, r1: 45, r2: 135 },
    { id: 'compass',       tl: 0, tr: 0, br: 0, bl: 0, r1: 20, r2: 70 },
    { id: 'soft_star',     tl: 10, tr: 10, br: 10, bl: 10, r1: 0, r2: 45 },
    { id: 'half_circle',   tl: s, tr: s, br: 0, bl: 0, r1: 0, r2: 0 },
    { id: 'cross_star',    tl: 8, tr: s, br: 8, bl: s, r1: 0, r2: 45 },
    { id: 'windmill',      tl: 0, tr: 20, br: 0, bl: 20, r1: 0, r2: 45 },
    { id: 'propeller',     tl: 0, tr: 20, br: 0, bl: 20, r1: 0, r2: 90 },
    { id: 'sharp_shield',  tl: 0, tr: 0, br: s, bl: s, r1: 0, r2: 45 },
    { id: 'gem',           tl: 20, tr: 0, br: 20, bl: 0, r1: 0, r2: 45 },
    { id: 'rotated_drop',  tl: 0, tr: s, br: s, bl: s, r1: -45, r2: 45 },
    { id: 'polygon',       tl: 5, tr: 0, br: 5, bl: 0, r1: 0, r2: 45 },
  ];

  const progress = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);
  const [tick, setTick] = useState(0);

  const shapeGen = useRef(new BagRandomizer(SHAPES, 'id')).current;
  const colorGen = useRef(new BagRandomizer(GRADIENTS)).current;
  const angleGen = useRef(new BagRandomizer(ANGLES, 'id')).current;

  const data = useRef({
    slot0: { shape: shapeGen.next(), color: colorGen.next(), angle: angleGen.next(), baseRot: 0 },
    slot1: { shape: shapeGen.next(), color: colorGen.next(), angle: angleGen.next(), baseRot: 135 },
    goingToOne: true 
  }).current;

  useEffect(() => {
    isMounted.current = true;

    Animated.spring(entranceAnim, {
      toValue: 1,
      delay: 300,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    return () => { isMounted.current = false; };
  }, [entranceAnim]);

  useEffect(() => {
    const toValue = data.goingToOne ? 1 : 0;
    
    const anim = Animated.timing(progress, {
      toValue,
      duration: 850,
      delay: 150,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && isMounted.current) {
        if (data.goingToOne) {
          data.slot0.shape = shapeGen.next();
          data.slot0.color = colorGen.next();
          data.slot0.angle = angleGen.next();
          data.slot0.baseRot = data.slot1.baseRot + 135;
          data.goingToOne = false;
        } else {
          data.slot1.shape = shapeGen.next();
          data.slot1.color = colorGen.next();
          data.slot1.angle = angleGen.next();
          data.slot1.baseRot = data.slot0.baseRot + 135;
          data.goingToOne = true;
        }
        setTick(t => t + 1); 
      }
    });

    return () => anim.stop();
  }, [tick, progress, shapeGen, colorGen, angleGen, data]);

  const tl = progress.interpolate({ inputRange: [0, 1], outputRange: [data.slot0.shape.tl, data.slot1.shape.tl] });
  const tr = progress.interpolate({ inputRange: [0, 1], outputRange: [data.slot0.shape.tr, data.slot1.shape.tr] });
  const br = progress.interpolate({ inputRange: [0, 1], outputRange: [data.slot0.shape.br, data.slot1.shape.br] });
  const bl = progress.interpolate({ inputRange: [0, 1], outputRange: [data.slot0.shape.bl, data.slot1.shape.bl] });

  const rot1 = progress.interpolate({ inputRange: [0, 1], outputRange: [`${data.slot0.baseRot + data.slot0.shape.r1}deg`, `${data.slot1.baseRot + data.slot1.shape.r1}deg`] });
  const rot2 = progress.interpolate({ inputRange: [0, 1], outputRange: [`${data.slot0.baseRot + data.slot0.shape.r2}deg`, `${data.slot1.baseRot + data.slot1.shape.r2}deg`] });

  const negRot1 = progress.interpolate({ inputRange: [0, 1], outputRange: [`-${data.slot0.baseRot + data.slot0.shape.r1}deg`, `-${data.slot1.baseRot + data.slot1.shape.r1}deg`] });
  const negRot2 = progress.interpolate({ inputRange: [0, 1], outputRange: [`-${data.slot0.baseRot + data.slot0.shape.r2}deg`, `-${data.slot1.baseRot + data.slot1.shape.r2}deg`] });

  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.65, 1] });

  const renderLayer = (rotate, negRotate) => (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderTopLeftRadius: tl,
        borderTopRightRadius: tr,
        borderBottomRightRadius: br,
        borderBottomLeftRadius: bl,
        overflow: 'hidden',
        transform: [{ rotate }],
      }}
    >
      <Animated.View
        style={{
          width: size * 1.5,
          height: size * 1.5,
          top: -size * 0.25,
          left: -size * 0.25,
          transform: [{ rotate: negRotate }], 
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: 1 }]}>
          <LinearGradient 
            colors={data.slot0.color} 
            start={data.slot0.angle.start} 
            end={data.slot0.angle.end} 
            style={StyleSheet.absoluteFill} 
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <LinearGradient 
            colors={data.slot1.color} 
            start={data.slot1.angle.start} 
            end={data.slot1.angle.end} 
            style={StyleSheet.absoluteFill} 
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, style]}>
      <Animated.View 
        style={{ 
          width: size, 
          height: size, 
          opacity: entranceAnim,
          transform: [
            { scale: entranceAnim },
            { scale }
          ] 
        }}
      >
        {renderLayer(rot1, negRot1)}
        {renderLayer(rot2, negRot2)}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
});

export default MorphingLoader;