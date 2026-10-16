const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const tinycolor = require('tinycolor2');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const filename = path.resolve(__dirname, '../src/components/attachments/AttachmentImagePreview.jsx');
const compiled = babel.transformFileSync(filename).code;
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const assertFillsParent = (style) => {
  const frame = flatten(style);
  assert.equal(frame.position, 'absolute');
  assert.deepEqual([frame.left, frame.top, frame.right, frame.bottom], [0, 0, 0, 0]);
};
const photo = (id) => ({
  id, name: `${id}.webp`, mimeType: 'image/webp', storagePath: `photos/${id}`,
  localUri: `file:///cache/${id}.webp`, downloadURL: `https://example.com/${id}.webp`,
});

function createAnimationClock(reduceMotion = false) {
  let time = 0;
  const running = new Set();
  const value = initial => {
    let current = initial, animation;
    return {
      get value() { return current; },
      set value(next) {
        if (animation && running.has(animation)) {
          running.delete(animation);
          animation.done?.(false);
        }
        animation = null;
        if (next?.timing) {
          animation = {
            start: time, from: current, target: next.target,
            duration: reduceMotion ? 0 : next.config.duration,
            set: nextValue => { current = nextValue; }, done: next.done,
          };
          running.add(animation);
        } else {
          current = next;
        }
      },
    };
  };
  return {
    value,
    timing: (target, config, done) => ({ timing: true, target, config, done }),
    advance(milliseconds) {
      time += milliseconds;
      const completed = [];
      for (const animation of running) {
        const progress = animation.duration ? Math.min(1, (time - animation.start) / animation.duration) : 1;
        animation.set(animation.from + (animation.target - animation.from) * progress);
        if (progress === 1) { running.delete(animation); completed.push(animation); }
      }
      for (const animation of completed) animation.done?.(true);
    },
  };
}

async function renderPreview(t, platform, options = {}) {
  const attachments = options.attachments || [photo('first'), photo('second')];
  const downloads = [], cacheChanges = [], gestures = [], closed = [];
  const clock = options.animate ? createAnimationClock(options.reduceMotion) : null;
  let dimensions = { width: 390, height: 844 };
  const makeGesture = (type) => {
    const callbacks = {}, settings = {};
    const gesture = new Proxy({}, { get: (_, name) => (...args) => {
      if (/^on[A-Z]/.test(name)) callbacks[name] = args[0];
      else settings[name] = args[0];
      return gesture;
    } });
    gestures.push({ type, callbacks, settings });
    return gesture;
  };
  const List = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex() {}, scrollToOffset() {} }));
    return React.createElement('List', props, props.data.map((item, index) => (
      React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item, index }))
    )));
  });
  const Pager = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ setPage() {}, setPageWithoutAnimation() {}, setScrollEnabled() {} }));
    return React.createElement('Pager', props, props.children);
  });
  const sharedValue = (value) => React.useRef(clock ? clock.value(value) : { value }).current;
  const animationFrame = global.requestAnimationFrame;
  const cancelFrame = global.cancelAnimationFrame;
  const frames = new Map();
  let frameId = 0;
  global.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  global.cancelAnimationFrame = id => frames.delete(id);

  const mocks = {
    react: React,
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', Modal: 'Modal', FlatList: List,
      Image: { getSize: (_uri, done) => done(1200, 800) },
      Platform: { OS: platform }, useWindowDimensions: () => dimensions,
      StyleSheet: { create: value => value, absoluteFill },
    },
    'expo-image': { Image: 'ZoomImage' },
    'react-native-gesture-handler': {
      Gesture: {
        Pinch: () => makeGesture('Pinch'), Pan: () => makeGesture('Pan'), Tap: () => makeGesture('Tap'),
        Simultaneous: (...items) => ({ items }),
      },
      GestureDetector: ({ children }) => children, GestureHandlerRootView: 'GestureRoot',
    },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView', Image: 'ZoomImage' },
      Easing: { out: value => value, cubic: value => value },
      useSharedValue: sharedValue, useAnimatedStyle: callback => callback(),
      withTiming: clock ? clock.timing : value => value,
      withSpring: value => value, runOnJS: callback => callback, runOnUI: callback => callback,
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    'phosphor-react-native': new Proxy({}, { get: (_, name) => name }),
    '../../services/attachmentService': {
      isImageAttachment: item => item?.mimeType?.startsWith('image/'),
      getAttachmentCacheState: async item => options.cacheState
        ? options.cacheState(item)
        : { status: 'local', uri: item.localUri },
      ensureLocalAttachment: async (item, settings) => {
        downloads.push({ item, settings });
        return options.download ? options.download(item, settings) : item;
      },
      formatAttachmentError: error => error.message,
      getAttachmentShareLabel: () => 'Share',
    },
    '../ui/MorphingLoader': 'Loader', './AndroidPagerView': Pager,
    '../ui/GradientBackground': props => React.createElement(props.component, props),
    './StagedAttachmentImage': { __esModule: true, default: 'Thumbnail', AttachmentImageLoadingOverlay: 'ImageLoader' },
    '../../utils/i18n': { t: key => key }, '../../utils/haptics': { triggerHaptic() {} },
  };
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name.startsWith('@babel/runtime/') || name === 'react/jsx-runtime') return originalRequire(name);
    assert.ok(name in mocks, `Unexpected preview dependency: ${name}`);
    return mocks[name];
  };
  loaded._compile(compiled, filename);
  const Preview = loaded.exports.default;
  let renderer;
  let props = {
    visible: options.visible ?? true, attachment: attachments[options.initialIndex || 0], attachments, lang: 'uk',
    onCacheStateChange: item => cacheChanges.push(item),
    onClose: () => closed.push(true),
  };
  await act(async () => { renderer = create(React.createElement(Preview, props)); });
  t.after(async () => {
    await act(async () => renderer.unmount());
    global.requestAnimationFrame = animationFrame;
    global.cancelAnimationFrame = cancelFrame;
  });
  return {
    root: () => renderer.root, downloads, cacheChanges, gestures, closed,
    dismiss: () => gestures.findLast(gesture => gesture.type === 'Pan' && gesture.settings.activeOffsetY !== undefined),
    layers: () => {
      const views = renderer.root.findAllByType('AnimatedView');
      const style = predicate => {
        const view = views.find(view => predicate(flatten(view.props.style), view.props));
        return view ? flatten(view.props.style) : undefined;
      };
      return {
        background: style(style => !!style.backgroundColor),
        gradient: style((_, props) => Array.isArray(props.colors)),
        photo: style(style => style.zIndex === 1),
        header: style(style => style.zIndex === 20),
        thumbnails: style(style => style.zIndex === 18),
      };
    },
    async advance(milliseconds) {
      await act(async () => {
        clock.advance(milliseconds);
        renderer.update(React.createElement(Preview, { ...props }));
      });
    },
    async show() {
      await act(async () => {
        const callbacks = Array.from(frames.values());
        frames.clear();
        callbacks.forEach(callback => callback());
      });
      await this.advance(300);
    },
    image: (id = 'first') => renderer.root.findAllByType('ZoomImage').find(node => node.props.source.uri.includes(id)),
    retry: () => renderer.root.findByProps({ accessibilityLabel: 'common.retry' }),
    async update(nextProps = {}, nextDimensions) {
      props = { ...props, ...nextProps };
      if (nextDimensions) dimensions = nextDimensions;
      await act(async () => renderer.update(React.createElement(Preview, props)));
    },
  };
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: close fades every gallery layer together and ignores late gesture cancellation`, async t => {
    const preview = await renderPreview(t, platform, { animate: true });
    await preview.show();
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(50);
    const opacities = Object.values(preview.layers()).map(style => style.opacity);
    assert.ok(opacities.every(opacity => opacity > 0 && opacity < 1));
    assert.ok(opacities.every(opacity => opacity === opacities[0]));
    const beforeCancel = preview.layers();
    await act(async () => preview.dismiss().callbacks.onFinalize({}, false));
    await preview.advance(0);
    assert.deepEqual(preview.layers(), beforeCancel, 'late cancellation must not restart the opening animation');
    await preview.advance(100);
    assert.equal(preview.closed.length, 0);
    assert.ok(Object.values(preview.layers()).every(style => style.opacity < opacities[0]));
    await preview.advance(50);
    assert.ok(Object.values(preview.layers()).every(style => style.opacity === 0));
    assert.equal(preview.closed.length, 1);
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(250);
    assert.equal(preview.closed.length, 1);
  });

  test(`${platform}: committed swipe continues from the finger while the thumbnail rail stays fixed`, async t => {
    const preview = await renderPreview(t, platform, { animate: true });
    await preview.show();
    const swipe = { translationX: 10, translationY: 200, velocityY: 0 };
    await act(async () => preview.dismiss().callbacks.onUpdate(swipe));
    await preview.advance(0);
    assert.equal(preview.layers().thumbnails.transform[0].translateY, 0);
    assert.equal(preview.layers().thumbnails.opacity, preview.layers().background.opacity);
    await act(async () => preview.dismiss().callbacks.onEnd(swipe));
    await preview.advance(100);
    const halfway = preview.layers();
    assert.ok(halfway.photo.transform[1].translateY > swipe.translationY);
    assert.ok(halfway.photo.transform[1].translateY < swipe.translationY + 101);
    assert.equal(halfway.thumbnails.transform[0].translateY, 0);
    assert.equal(halfway.photo.opacity, 0.5);
    await act(async () => preview.dismiss().callbacks.onFinalize({}, false));
    await preview.advance(100);
    assert.equal(preview.closed.length, 1);
    assert.equal(preview.layers().photo.opacity, 0);
  });

  test(`${platform}: a short swipe restores the gallery and leaves close available`, async t => {
    const preview = await renderPreview(t, platform, { animate: true });
    await preview.show();
    const swipe = { translationX: 5, translationY: 20, velocityY: 0 };
    await act(async () => {
      preview.dismiss().callbacks.onUpdate(swipe);
      preview.dismiss().callbacks.onEnd(swipe);
      preview.dismiss().callbacks.onFinalize({}, true);
    });
    await preview.advance(200);
    assert.equal(preview.closed.length, 0);
    assert.ok(Object.values(preview.layers()).every(style => style.opacity === 1));
    assert.equal(preview.layers().photo.transform[1].translateY, 0);
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(200);
    assert.equal(preview.closed.length, 1);
  });

  test(`${platform}: reduced motion still completes close exactly once`, async t => {
    const preview = await renderPreview(t, platform, { animate: true, reduceMotion: true });
    await preview.show();
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(0);
    assert.equal(preview.closed.length, 1);
    assert.ok(Object.values(preview.layers()).every(style => style.opacity === 0));
  });

  test(`${platform}: reopening restores every layer after a completed dismissal`, async t => {
    const preview = await renderPreview(t, platform, { animate: true });
    await preview.show();
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(200);
    await preview.update({ visible: false });
    await preview.update({ visible: true });
    await preview.show();
    assert.ok(Object.values(preview.layers()).every(style => style.opacity === 1));
    assert.equal(preview.layers().photo.transform[1].translateY, 0);
    await act(async () => preview.root().findByProps({ accessibilityLabel: 'common.close' }).props.onPress());
    await preview.advance(200);
    assert.equal(preview.closed.length, 2);
  });
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: zoom keeps dismissal and paging disabled until the image is reset`, async t => {
    const preview = await renderPreview(t, platform, { animate: true });
    await preview.show();
    const tap = preview.gestures.find(gesture => gesture.type === 'Tap');
    await act(async () => tap.callbacks.onEnd({ x: 180, y: 220 }, true));
    assert.equal(preview.dismiss().settings.enabled, false);
    const paging = () => platform === 'android' ? preview.root().findByType('Pager')
      : preview.root().findAllByType('List').find(list => list.props.pagingEnabled);
    assert.equal(paging().props.scrollEnabled, false);
    await act(async () => tap.callbacks.onEnd({ x: 180, y: 220 }, true));
    assert.equal(preview.dismiss().settings.enabled, true);
    assert.equal(paging().props.scrollEnabled, true);
  });
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: gallery background and photos fill the viewport using the native StyleSheet API`, async t => {
    const preview = await renderPreview(t, platform, { visible: false, initialIndex: 1 });
    await preview.update({ visible: true });
    const backdrop = preview.root().findAllByType('AnimatedView').find(view => view.props.pointerEvents === 'none');
    const background = flatten(backdrop.props.style);
    assertFillsParent(backdrop.props.style);
    assert.ok(background.backgroundColor);
    const stage = preview.root().findAllByType('AnimatedView').find(view => flatten(view.props.style).zIndex === 1);
    assertFillsParent(stage.props.style);
    for (const loader of preview.root().findAllByType('ImageLoader')) assertFillsParent(loader.props.style);
  });

  test(`${platform}: all gallery gesture handlers are compiled for the UI thread`, async t => {
    const preview = await renderPreview(t, platform);
    const callbacks = preview.gestures.flatMap(gesture => Object.entries(gesture.callbacks));
    assert.ok(callbacks.length > 0);
    for (const [name, callback] of callbacks) {
      assert.equal(typeof callback.__workletHash, 'number', `${name} must run as a worklet`);
    }
  });
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: thumbnail loading layers overlay the image without taking layout space`, async t => {
    const imageFile = path.resolve(__dirname, '../src/components/attachments/StagedAttachmentImage.jsx');
    class Value {
      constructor(value) { this.value = value; }
      setValue(value) { this.value = value; }
      stopAnimation() {}
      interpolate() { return 0; }
    }
    const mocks = {
      react: React,
      'expo-image': { Image: 'StagedImage' },
      'react-native': {
        View: 'View', Image: 'PreviewImage', Platform: { OS: platform },
        StyleSheet: { create: value => value, absoluteFill },
        Easing: { out: value => value, cubic: value => value },
        Animated: {
          View: 'LoadingOverlay', Image: 'StagedImage', Value,
          timing: (value, settings) => ({ start(done) { value.setValue(settings.toValue); done?.({ finished: true }); } }),
        },
      },
      '../../hooks/useReducedMotionPreference': () => true,
      '../ui/GradientBackground': 'Gradient',
    };
    const loaded = new Module(imageFile, module);
    loaded.filename = imageFile;
    loaded.paths = Module._nodeModulePaths(path.dirname(imageFile));
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = name => name in mocks ? mocks[name] : originalRequire(name);
    loaded._compile(babel.transformFileSync(imageFile).code, imageFile);
    let renderer;
    await act(async () => {
      renderer = create(React.createElement(loaded.exports.default, {
        attachment: { ...photo('first'), imagePreview: { uri: 'data:image/jpeg;base64,preview' } },
        uri: photo('first').localUri, resizeMode: 'contain', loaderDelayMs: 0, loaderScanning: false,
      }));
    });
    t.after(async () => act(async () => renderer.unmount()));
    assertFillsParent(renderer.root.findByType('StagedImage').props.style);
    assertFillsParent(renderer.root.findByType('LoadingOverlay').props.style);
    assertFillsParent(renderer.root.findByType('PreviewImage').props.style);
    assertFillsParent(renderer.root.findByType('PreviewImage').parent.props.style);
    await act(async () => renderer.root.findByType('StagedImage').props.onLoad({}));
    assert.equal(renderer.root.findAllByType('LoadingOverlay').length, 0);
  });
}

for (const platform of ['android', 'ios', 'web']) {
  test(`${platform}: failed image reloads even when the cache URI stays the same`, async t => {
    const preview = await renderPreview(t, platform);
    const original = preview.image();
    const uri = original.props.source.uri;
    await act(async () => original.props.onError());
    assert.equal(preview.downloads.length, 1);
    assert.deepEqual(preview.downloads[0].settings, { forceDownload: true });
    assert.equal(preview.image().props.source.uri, uri);
    assert.notEqual(preview.image(), original, 'the failed native image must be remounted');
    await act(async () => preview.image().props.onLoad({ source: { width: 1200, height: 800 } }));
    const viewport = preview.image().parent.parent;
    assert.equal(viewport.findByType('ImageLoader').props.active, false);
  });

  test(`${platform}: repeated decoding failure stops automatic retries and offers recovery`, async t => {
    const preview = await renderPreview(t, platform);
    await act(async () => preview.image().props.onError());
    await act(async () => preview.image().props.onError());
    assert.equal(preview.downloads.length, 1);
    assert.ok(preview.root().findAllByType('Text').some(node => node.props.children === 'attachments.errors.open_failed'));
    await act(async () => preview.retry().props.onPress());
    assert.equal(preview.downloads.length, 2);
    assert.ok(preview.image());
    assert.equal(preview.root().findAllByProps({ accessibilityLabel: 'common.retry' }).length, 0);
  });

  test(`${platform}: download failure stays visible and can be retried after returning online`, async t => {
    let offline = true;
    const preview = await renderPreview(t, platform, { download: async item => {
      if (offline) throw new Error('Offline');
      return { ...item, localUri: 'file:///fresh/first.webp' };
    } });
    await act(async () => preview.image().props.onError());
    assert.ok(preview.root().findAllByType('Text').some(node => node.props.children === 'Offline'));
    offline = false;
    await act(async () => preview.retry().props.onPress());
    assert.equal(preview.image().props.source.uri, 'file:///fresh/first.webp');
  });

  test(`${platform}: failed cached image is recovered even after an earlier successful load`, async t => {
    const preview = await renderPreview(t, platform);
    await act(async () => preview.image().props.onLoad({ nativeEvent: { source: { width: 1200, height: 800 } } }));
    await act(async () => preview.image().props.onError());
    assert.equal(preview.downloads.length, 1);
    assert.ok(preview.image());
  });

  test(`${platform}: closing a preview prevents an old download from changing the next preview`, async t => {
    let finish;
    const preview = await renderPreview(t, platform, { download: () => new Promise(resolve => { finish = resolve; }) });
    await act(async () => preview.image().props.onError());
    const before = preview.cacheChanges.length;
    await preview.update({ visible: false });
    await act(async () => finish({ ...photo('first'), localUri: 'file:///outdated/first.webp' }));
    assert.equal(preview.cacheChanges.length, before);
    await preview.update({ visible: true });
    assert.equal(preview.image().props.source.uri, photo('first').localUri);
  });

  test(`${platform}: duplicate error events share one recovery request`, async t => {
    let finish;
    const preview = await renderPreview(t, platform, { download: () => new Promise(resolve => { finish = resolve; }) });
    const onError = preview.image().props.onError;
    await act(async () => { onError(); onError(); });
    assert.equal(preview.downloads.length, 1);
    await act(async () => finish(photo('first')));
    assert.ok(preview.image());
    assert.equal(preview.root().findAllByProps({ accessibilityLabel: 'common.retry' }).length, 0);
  });

  test(`${platform}: a failed background recovery does not put an error on another photo`, async t => {
    let rejectDownload;
    const preview = await renderPreview(t, platform, { download: () => new Promise((_, reject) => { rejectDownload = reject; }) });
    await act(async () => preview.image().props.onError());
    const open = id => preview.root().findByProps({ accessibilityLabel: `attachments.open: ${id}.webp` }).props.onPress();
    await act(async () => open('second'));
    await act(async () => rejectDownload(new Error('Offline')));
    assert.equal(preview.root().findAllByProps({ accessibilityLabel: 'common.retry' }).length, 0);
    await act(async () => open('first'));
    assert.ok(preview.retry());
  });

  test(`${platform}: recovery waits for initial cache resolution before replacing the file`, async t => {
    let finishCache;
    const attachments = [photo('first')];
    const preview = await renderPreview(t, platform, {
      attachments,
      cacheState: () => new Promise(resolve => { finishCache = resolve; }),
      download: async item => ({ ...item, localUri: 'file:///fresh/first.webp' }),
    });
    await act(async () => preview.image().props.onError());
    assert.equal(preview.downloads.length, 0);
    await act(async () => finishCache({ status: 'local', uri: attachments[0].localUri }));
    assert.equal(preview.downloads.length, 1);
    assert.equal(preview.image().props.source.uri, 'file:///fresh/first.webp');
  });
}

test('Android pager pages fill the native viewport and remain mounted while swiping', async t => {
  const attachments = [photo('first'), photo('second'), photo('third'), photo('fourth')];
  const preview = await renderPreview(t, 'android', { attachments });
  const pager = () => preview.root().findByType('Pager');
  for (const page of pager().props.children) {
    assert.equal(page.props.collapsable, false);
    const style = flatten(page.props.style);
    assert.equal(style.width, '100%');
    assert.equal(style.height, '100%');
  }
  await act(async () => pager().props.onPageSelected({ nativeEvent: { position: 3 } }));
  assert.ok(preview.image('fourth'));
});

test('iOS gallery pages keep their viewport dimensions after rotating the phone', async t => {
  const preview = await renderPreview(t, 'ios');
  const page = () => preview.root().findAllByType('List').find(list => list.props.pagingEnabled)
    .findAllByType('View').find(view => flatten(view.props.style).paddingTop !== undefined);
  assert.equal(flatten(page().props.style).width, 390);
  assert.equal(flatten(page().props.style).height, 844);
  await preview.update({}, { width: 844, height: 390 });
  assert.equal(flatten(page().props.style).width, 844);
  assert.equal(flatten(page().props.style).height, 390);
});

for (const platform of ['ios', 'android', 'web']) {
  for (const count of [1, 3]) {
    test(`${platform}: ${count} photo gallery reveals the background while keeping a darker footer`, async t => {
      const attachments = Array.from({ length: count }, (_, index) => photo(`image-${index}`));
      const preview = await renderPreview(t, platform, { animate: true, attachments });
      await preview.show();
      const gradient = preview.root().findAllByType('AnimatedView').find(view => Array.isArray(view.props.colors));
      assertFillsParent(gradient.props.style);
      assert.equal(gradient.props.pointerEvents, 'none');
      const [topAlpha, bottomAlpha] = [gradient.props.colors[0], gradient.props.colors.at(-1)]
        .map(color => tinycolor(color).getAlpha());
      assert.equal(topAlpha, 0);
      assert.ok(bottomAlpha >= 0.95);
      for (const translationY of [50, 200, 600, 150]) {
        await act(async () => preview.dismiss().callbacks.onUpdate({ translationX: 4, translationY }));
        await preview.advance(0);
        const layers = preview.layers();
        assert.ok(layers.background.opacity < 1, 'the previous screen is revealed during the swipe');
        assert.equal(layers.gradient.opacity, 1, 'the lower edge stays shaded even during a long swipe');
        assert.equal(layers.gradient.transform, undefined, 'the gradient stays fixed to the screen');
        const bottomOpacity = layers.background.opacity + bottomAlpha * (1 - layers.background.opacity);
        assert.ok(bottomOpacity > 0.95, 'navigation must remain subdued while the photo crosses it');
        assert.equal(layers.photo.transform[1].translateY, translationY, 'the full photo still follows the finger');
      }
      await act(async () => preview.dismiss().callbacks.onEnd({ translationX: 4, translationY: 150, velocityY: 0 }));
      await preview.advance(100);
      assert.equal(preview.layers().gradient.opacity, preview.layers().photo.opacity);
      await preview.advance(100);
      assert.equal(preview.layers().gradient.opacity, 0);
      assert.equal(preview.closed.length, 1);
    });
  }
}
