import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const SECRET_PIN = '1337';

const COLORS = {
  background: '#F3F4EF',
  surface: '#FFFFFF',
  ink: '#20231F',
  muted: '#777D73',
  line: '#E1E4DC',
  utility: '#E6E9E1',
  accent: '#D5F36A',
  danger: '#D94E43',
};

const calculatorKeys = [
  ['AC', 'sign', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['backspace', '0', '.', '='],
];

function evaluateExpression(source: string) {
  const expression = source.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-');
  let cursor = 0;

  function parseNumber(): number {
    const start = cursor;
    if (expression[cursor] === '+' || expression[cursor] === '-') cursor += 1;
    let hasDigit = false;
    while (/[0-9]/.test(expression[cursor] ?? '')) {
      hasDigit = true;
      cursor += 1;
    }
    if (expression[cursor] === '.') {
      cursor += 1;
      while (/[0-9]/.test(expression[cursor] ?? '')) {
        hasDigit = true;
        cursor += 1;
      }
    }
    if (!hasDigit) throw new Error('Invalid expression');
    let value = Number(expression.slice(start, cursor));
    if (expression[cursor] === '%') {
      value /= 100;
      cursor += 1;
    }
    return value;
  }

  function parseProduct(): number {
    let value = parseNumber();
    while (expression[cursor] === '*' || expression[cursor] === '/') {
      const operator = expression[cursor++];
      const next = parseNumber();
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  }

  function parseSum(): number {
    let value = parseProduct();
    while (expression[cursor] === '+' || expression[cursor] === '-') {
      const operator = expression[cursor++];
      const next = parseProduct();
      value = operator === '+' ? value + next : value - next;
    }
    return value;
  }

  const value = parseSum();
  if (cursor !== expression.length || !Number.isFinite(value)) throw new Error('Invalid expression');
  return Number(value.toPrecision(12)).toString();
}

function getAddressUrl(value: string) {
  const query = value.trim();
  if (/^https?:\/\//i.test(query)) return query;
  if (/^(localhost(?::\d+)?|(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s]*)?)$/i.test(query)) {
    return `https://${query}`;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

function CalculatorKey({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const isOperator = ['÷', '×', '−', '+'].includes(label);
  const isUtility = ['AC', 'sign', '%', 'backspace'].includes(label);
  const isEqual = label === '=';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'sign' ? 'Change sign' : label === 'backspace' ? 'Delete' : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        isOperator && styles.operatorKey,
        isUtility && styles.utilityKey,
        isEqual && styles.equalKey,
        label === '0' && styles.zeroKey,
        pressed && styles.keyPressed,
      ]}>
      {label === 'backspace' ? (
        <Ionicons name="backspace-outline" size={25} color={COLORS.ink} />
      ) : label === 'sign' ? (
        <Text style={styles.utilityLabel}>+/−</Text>
      ) : (
        <Text style={[styles.keyLabel, isUtility && styles.utilityLabel, isEqual && styles.equalLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function PrivateBrowser({ onPanic }: { onPanic: () => void }) {
  const webViewRef = useRef<WebView<{}>>(null);
  const [address, setAddress] = useState('');
  const [browserUrl, setBrowserUrl] = useState('https://duckduckgo.com');
  const [sessionKey, setSessionKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const navigate = () => {
    const url = getAddressUrl(address);
    setAddress(url);
    setBrowserUrl(url);
    Keyboard.dismiss();
  };

  const clearSession = () => {
    webViewRef.current?.clearCache(true);
    webViewRef.current?.clearHistory?.();
    setCanGoBack(false);
    setCanGoForward(false);
    setAddress('');
    setBrowserUrl('https://duckduckgo.com');
    setProgress(0);
    setSessionKey((key) => key + 1);
  };

  return (
    <SafeAreaView style={styles.browserScreen} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.browserHeader}>
        <View style={styles.addressRow}>
          <Ionicons name="lock-closed-outline" size={17} color={COLORS.muted} />
          <TextInput
            accessibilityLabel="Search or enter address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setAddress}
            onSubmitEditing={navigate}
            placeholder="Search or enter address"
            placeholderTextColor={COLORS.muted}
            returnKeyType="go"
            selectTextOnFocus
            style={styles.addressInput}
            value={address}
          />
          <Pressable accessibilityLabel="Go" onPress={navigate} hitSlop={8} style={styles.goButton}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.ink} />
          </Pressable>
        </View>
        <View style={styles.navigationRow}>
          <BrowserIconButton
            accessibilityLabel="Back"
            disabled={!canGoBack}
            name="arrow-back"
            onPress={() => webViewRef.current?.goBack()}
          />
          <BrowserIconButton
            accessibilityLabel="Forward"
            disabled={!canGoForward}
            name="arrow-forward"
            onPress={() => webViewRef.current?.goForward()}
          />
          <BrowserIconButton
            accessibilityLabel="Reload"
            name="refresh"
            onPress={() => webViewRef.current?.reload()}
          />
          <View style={styles.browserActions}>
            <Pressable accessibilityRole="button" onPress={clearSession} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={15} color={COLORS.ink} />
              <Text style={styles.actionLabel}>Clear Session</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onPanic} style={styles.panicButton}>
              <Ionicons name="calculator-outline" size={15} color={COLORS.surface} />
              <Text style={styles.panicLabel}>Panic / Lock</Text>
            </Pressable>
          </View>
        </View>
        {loading && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 8)}%` }]} />
          </View>
        )}
      </View>
      <WebView<{}>
        key={sessionKey}
        ref={webViewRef}
        source={{ uri: browserUrl }}
        style={styles.webView}
        incognito
        cacheEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadStart={() => {
          setLoading(true);
          setProgress(0);
        }}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        onLoadEnd={() => {
          setLoading(false);
          setProgress(1);
        }}
        onNavigationStateChange={(state) => {
          setCanGoBack(state.canGoBack);
          setCanGoForward(state.canGoForward);
          setAddress(state.url);
        }}
        renderLoading={() => <ActivityIndicator color={COLORS.ink} />}
      />
    </SafeAreaView>
  );
}

function BrowserIconButton({
  accessibilityLabel,
  disabled = false,
  name,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.browserIconButton, disabled && styles.disabledControl, pressed && styles.keyPressed]}>
      <Ionicons name={name} size={19} color={COLORS.ink} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const [expression, setExpression] = useState('0');
  const [result, setResult] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const resetCalculator = () => {
    setExpression('0');
    setResult(null);
    setJustEvaluated(false);
  };

  const pressKey = (key: string) => {
    if (key === 'AC') {
      resetCalculator();
      return;
    }
    if (key === 'backspace') {
      setExpression((current) => current.length <= 1 ? '0' : current.slice(0, -1));
      setResult(null);
      setJustEvaluated(false);
      return;
    }
    if (key === '=') {
      if (expression === SECRET_PIN) {
        resetCalculator();
        setUnlocked(true);
        return;
      }
      try {
        const answer = evaluateExpression(expression);
        setExpression(answer);
        setResult(answer);
        setJustEvaluated(true);
      } catch {
        setResult('Error');
      }
      return;
    }
    if (key === 'sign') {
      const match = expression.match(/(.*)([+\-*/])(-?\d*\.?\d+%?)$/);
      if (match) {
        const [, prefix, operator, operand] = match;
        if (operator === '+' || operator === '-') {
          setExpression(`${prefix}${operator === '+' ? '-' : '+'}${operand}`);
        } else {
          setExpression(`${prefix}${operator}${operand.startsWith('-') ? operand.slice(1) : `-${operand}`}`);
        }
      } else if (expression !== '0') {
        setExpression(expression.startsWith('-') ? expression.slice(1) : `-${expression}`);
      }
      setResult(null);
      return;
    }

    const isOperator = ['+', '−', '×', '÷'].includes(key);
    setJustEvaluated(false);
    setExpression((current) => {
      if (isOperator) {
        const operator = key === '−' ? '-' : key === '×' ? '*' : key === '÷' ? '/' : key;
        if (/[+\-*/]$/.test(current)) return `${current.slice(0, -1)}${operator}`;
        return `${current}${operator}`;
      }
      if (key === '%') {
        return /[0-9]$/.test(current) ? `${current}%` : current;
      }
      if (key === '.') {
        if (justEvaluated) return '0.';
        const currentNumber = current.split(/[+\-*/]/).pop() ?? '';
        if (currentNumber.includes('.')) return current;
        return /[+\-*/]$/.test(current) ? `${current}0.` : current === '0' ? '0.' : `${current}.`;
      }
      if (/\d/.test(key)) {
        if (justEvaluated) return key;
        if (current.endsWith('%')) return key;
        if (current === '0') return key;
        return `${current}${key}`;
      }
      return current;
    });
    setResult(null);
  };

  let preview: string | null = null;
  try {
    preview = evaluateExpression(expression);
  } catch {
    preview = null;
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.calculator} edges={['top', 'left', 'right']}>
        <View style={styles.calculatorHeader}>
          <View style={styles.calculatorMark}>
            <Ionicons name="calculator" size={19} color={COLORS.ink} />
          </View>
          <Text style={styles.screenTitle}>Calculator</Text>
          <Text style={styles.modeLabel}>STANDARD</Text>
        </View>

        <View style={styles.display}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.expressionText}>
            {expression.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−')}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.resultText}>
            {result ?? (preview !== expression ? preview ?? '' : '')}
          </Text>
        </View>

        <View style={styles.keypad}>
          {calculatorKeys.map((row, rowIndex) => (
            <View style={styles.keyRow} key={`row-${rowIndex}`}>
              {row.map((key) => (
                <CalculatorKey key={key} label={key} onPress={() => pressKey(key)} />
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>

      <Modal
        animationType="none"
        onRequestClose={() => setUnlocked(false)}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={unlocked}>
        {unlocked && <PrivateBrowser onPanic={() => setUnlocked(false)} />}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  calculator: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  calculatorHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  calculatorMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  screenTitle: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  modeLabel: {
    marginLeft: 'auto',
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  display: {
    flex: 1,
    minHeight: 118,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingVertical: 20,
  },
  expressionText: {
    maxWidth: '100%',
    color: COLORS.ink,
    fontSize: 45,
    fontWeight: '300',
  },
  resultText: {
    minHeight: 27,
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 19,
    fontWeight: '500',
  },
  keypad: {
    flex: 3.3,
    gap: 10,
  },
  keyRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  key: {
    flex: 1,
    minHeight: 48,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.62,
  },
  zeroKey: {
    flex: 1.62,
  },
  operatorKey: {
    backgroundColor: COLORS.utility,
  },
  utilityKey: {
    backgroundColor: COLORS.utility,
  },
  equalKey: {
    backgroundColor: COLORS.accent,
  },
  keyLabel: {
    color: COLORS.ink,
    fontSize: 25,
    fontWeight: '500',
  },
  utilityLabel: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '600',
  },
  equalLabel: {
    fontSize: 28,
    fontWeight: '700',
  },
  browserScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  browserHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
    backgroundColor: COLORS.background,
  },
  addressRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  addressInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    color: COLORS.ink,
    fontSize: 14,
  },
  goButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  navigationRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 7,
  },
  browserIconButton: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledControl: {
    opacity: 0.3,
  },
  browserActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 7,
    marginLeft: 4,
  },
  clearButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: COLORS.utility,
  },
  panicButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
  },
  actionLabel: {
    color: COLORS.ink,
    fontSize: 11,
    fontWeight: '600',
  },
  panicLabel: {
    color: COLORS.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: COLORS.line,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  webView: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
});
