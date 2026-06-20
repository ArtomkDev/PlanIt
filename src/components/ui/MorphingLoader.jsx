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
  ['#F09819', '#EDDE5D'], ['#8A2387', '#E94057'], ['#2193b0', '#6dd5ed'],
  ['#FF006E', '#8338EC'], ['#3A86FF', '#FB5607'], ['#FFBE0B', '#FB5607'],
  ['#06FFA5', '#00D084'], ['#00D4FF', '#0099FF'], ['#FF385A', '#FFB700'],
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'],
  ['#a8edea', '#fed6e3'], ['#ff9a56', '#ff6a88'], ['#2e2e78', '#662d91'],
  ['#00c6ff', '#0072ff'], ['#00b4db', '#0083b0'], ['#ff6e7f', '#bfe9ff'],
  ['#ffecd2', '#fcb69f'], ['#eb3349', '#f45c43'], ['#FFB347', '#FF6347'], 
  ['#87CEEB', '#4169E1'], ['#FF1493', '#FF69B4'], ['#00CED1', '#20B2AA'], 
  ['#FFD700', '#FFA500'], ['#98FB98', '#32CD32'], ['#DDA0DD', '#DA70D6'], 
  ['#F08080', '#CD5C5C'], ['#20B2AA', '#3CB371'], ['#FF8C00', '#FF4500'], 
  ['#9932CC', '#8A2BE2']
];

const ANGLES = [
  { id: 'tl-br', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  { id: 'tr-bl', start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  { id: 'bl-tr', start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  { id: 'br-tl', start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
  { id: 't-b',   start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  { id: 'l-r',   start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  { id: 'tl-br-45', start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.9 } },
  { id: 'tr-bl-45', start: { x: 0.9, y: 0.1 }, end: { x: 0.1, y: 0.9 } },
  { id: 'radial-tl', start: { x: 0, y: 0 }, end: { x: 0.5, y: 0.5 } },
  { id: 'radial-br', start: { x: 1, y: 1 }, end: { x: 0.5, y: 0.5 } },
  { id: 'horizontal-soft', start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 } },
  { id: 'vertical-soft', start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.8 } },
  { id: 'circular', start: { x: 0.5, y: 0.5 }, end: { x: 0, y: 0 } },
];

class SmartRandomizer {
  constructor(items, idKey = null, maxRecentMemory = 6) {
    this.allItems = items;
    this.idKey = idKey;
    this.recentHistory = [];
    this.maxMemory = maxRecentMemory;
    this.shuffledPool = [];
    this.refillPool();
  }

  refillPool() {
    this.shuffledPool = [...this.allItems];
    for (let i = this.shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledPool[i], this.shuffledPool[j]] = [this.shuffledPool[j], this.shuffledPool[i]];
    }
  }

  getItemId(item) {
    return this.idKey ? item[this.idKey] : item;
  }

  isInRecent(item) {
    const itemId = this.getItemId(item);
    return this.recentHistory.some(historyItem => 
      this.getItemId(historyItem) === itemId
    );
  }

  next() {
    let validItem = null;
    let attempts = 0;
    const maxAttempts = this.shuffledPool.length;

    while (attempts < maxAttempts) {
      if (this.shuffledPool.length === 0) {
        this.refillPool();
      }

      const candidate = this.shuffledPool.shift();
      
      if (!this.isInRecent(candidate)) {
        validItem = candidate;
        break;
      }
      attempts++;
    }

    if (!validItem && this.shuffledPool.length > 0) {
      validItem = this.shuffledPool.shift();
    }

    if (!validItem) {
      this.refillPool();
      validItem = this.shuffledPool.shift();
    }

    this.recentHistory.push(validItem);
    if (this.recentHistory.length > this.maxMemory) {
      this.recentHistory.shift();
    }

    return validItem;
  }
}

const MorphingLoader = ({ size = 60, style }) => {
  const s = size / 2;

  const SHAPES = [
    { id: 'perfect_circle',       tl: s,        tr: s,        br: s,        bl: s,        r1: 0,   r2: 0 },
    { id: 'soft_8_pointed_star',  tl: s * 0.4,  tr: s * 0.4,  br: s * 0.4,  bl: s * 0.4,  r1: 0,   r2: 45 },
    { id: 'organic_blob_smooth',  tl: s,        tr: s * 0.5,  br: s,        bl: s * 0.5,  r1: 15,  r2: 75 },
    { id: 'smooth_teardrop',      tl: s * 0.3,  tr: s,        br: s,        bl: s,        r1: -30, r2: 60 },
    { id: 'elegant_leaf',         tl: s,        tr: s * 0.35, br: s,        bl: s * 0.35, r1: 0,   r2: 90 },
    { id: 'soft_squarcle',        tl: s * 0.65, tr: s * 0.65, br: s * 0.65, bl: s * 0.65, r1: 0,   r2: 45 },
    { id: 'asymmetric_oval',      tl: s,        tr: s * 0.7,  br: s,        bl: s * 0.7,  r1: 10,  r2: 100 },
    { id: 'soft_mandala_base',    tl: s * 0.5,  tr: s * 0.95, br: s * 0.5,  bl: s * 0.95, r1: 0,   r2: 45 },
    { id: 'curved_petal',         tl: s * 0.35, tr: s,        br: s * 0.35, bl: s,        r1: 15,  r2: 75 },
    { id: 'magic_crystal_blob',   tl: s * 0.75, tr: s * 0.35, br: s * 0.75, bl: s * 0.35, r1: -25, r2: 65 }
  ];

  const progress = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);
  const [tick, setTick] = useState(0);

  const shapeGen = useRef(new SmartRandomizer(SHAPES, 'id', 7)).current;
  const colorGen = useRef(new SmartRandomizer(GRADIENTS, null, 15)).current;
  const angleGen = useRef(new SmartRandomizer(ANGLES, 'id', 8)).current;

  const data = useRef({
    slot0: { shape: shapeGen.next(), color: colorGen.next(), angle: angleGen.next(), baseRot: 0 },
    slot1: { shape: shapeGen.next(), color: colorGen.next(), angle: angleGen.next(), baseRot: 135 },
    goingToOne: true 
  }).current;

  useEffect(() => {
    isMounted.current = true;

    Animated.sequence([
      Animated.delay(250),
      Animated.spring(entranceAnim, {
        toValue: 1,
        friction: 7.5,
        tension: 55,
        useNativeDriver: false,
      })
    ]).start();

    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        })
      ])
    ).start();

    return () => { isMounted.current = false; };
  }, [entranceAnim, rotationAnim, pulseAnim]);

  useEffect(() => {
    const toValue = data.goingToOne ? 1 : 0;
    
    const anim = Animated.timing(progress, {
      toValue,
      duration: 1200,
      delay: 160,
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

  const negRot1 = progress.interpolate({ inputRange: [0, 1], outputRange: [`${-(data.slot0.baseRot + data.slot0.shape.r1)}deg`, `${-(data.slot1.baseRot + data.slot1.shape.r1)}deg`] });
  const negRot2 = progress.interpolate({ inputRange: [0, 1], outputRange: [`${-(data.slot0.baseRot + data.slot0.shape.r2)}deg`, `${-(data.slot1.baseRot + data.slot1.shape.r2)}deg`] });

  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.62, 1] });
  const rotation = rotationAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulse = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.07] });

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
            { scale },
            { scaleX: pulse },
            { scaleY: pulse },
            { rotate: rotation }
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