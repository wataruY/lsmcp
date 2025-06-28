/**
 * パフォーマンスデバッグの例
 * 
 * このスクリプトは、パフォーマンスの問題を
 * DAP MCPツールを使用してデバッグする方法を示します。
 */

// 非効率な実装（メモ化なし）
function fibonacciSlow(n) {
  if (n <= 1) return n;
  return fibonacciSlow(n - 1) + fibonacciSlow(n - 2);
}

// 効率的な実装（メモ化あり）
const memo = new Map();
function fibonacciFast(n) {
  if (n <= 1) return n;
  
  if (memo.has(n)) {
    return memo.get(n);
  }
  
  const result = fibonacciFast(n - 1) + fibonacciFast(n - 2);
  memo.set(n, result);
  return result;
}

// パフォーマンス測定
function measurePerformance(fn, n, label) {
  console.log(`\n${label}:`);
  
  const measurements = [];
  
  for (let i = 1; i <= n; i++) {
    const start = process.hrtime.bigint();
    const result = fn(i);
    const end = process.hrtime.bigint();
    
    const timeMs = Number(end - start) / 1000000;
    measurements.push({ n: i, result, timeMs });
    
    // 100ms以上かかった場合は警告
    if (timeMs > 100) {
      console.log(`  ⚠️  fib(${i}) = ${result} (${timeMs.toFixed(2)}ms) - SLOW!`);
    } else {
      console.log(`  fib(${i}) = ${result} (${timeMs.toFixed(2)}ms)`);
    }
  }
  
  return measurements;
}

// 大きな配列での処理性能テスト
function processLargeArray(size) {
  console.log(`\n大きな配列の処理 (サイズ: ${size}):`);
  
  // 配列の生成
  const arr = Array.from({ length: size }, (_, i) => i + 1);
  
  // 各種操作の性能測定
  const operations = {
    'filter (偶数)': () => arr.filter(x => x % 2 === 0),
    'map (二乗)': () => arr.map(x => x * x),
    'reduce (合計)': () => arr.reduce((sum, x) => sum + x, 0),
    'find (特定値)': () => arr.find(x => x === size / 2),
    'forEach (カウント)': () => {
      let count = 0;
      arr.forEach(() => count++);
      return count;
    }
  };
  
  const results = {};
  
  for (const [name, fn] of Object.entries(operations)) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    
    const timeMs = Number(end - start) / 1000000;
    results[name] = { timeMs, resultSample: Array.isArray(result) ? result.length : result };
    
    console.log(`  ${name}: ${timeMs.toFixed(2)}ms`);
  }
  
  return results;
}

function main() {
  console.log('=== パフォーマンスデバッグの例 ===');
  
  // フィボナッチ数列の比較
  console.log('\n--- フィボナッチ数列の性能比較 ---');
  
  // メモ化をクリア
  memo.clear();
  
  // 非効率な実装（n=30まで）
  measurePerformance(fibonacciSlow, 30, '非効率な実装（メモ化なし）');
  
  // 効率的な実装（n=100まで可能）
  measurePerformance(fibonacciFast, 40, '効率的な実装（メモ化あり）');
  
  // 大きな配列の処理
  console.log('\n--- 配列処理の性能測定 ---');
  processLargeArray(10000);
  processLargeArray(100000);
  
  console.log('\n=== 完了 ===');
}

// デバッグポイント
if (require.main === module) {
  main();
}

module.exports = { fibonacciSlow, fibonacciFast, processLargeArray };

/*
 * パフォーマンスデバッグのポイント:
 * 
 * 1. ブレークポイントを関数の入口に設定して呼び出し回数を確認
 * 2. 条件付きブレークポイントで特定の条件（例: n > 25）でのみ停止
 * 3. 値の追跡で計算結果をモニタリング
 * 4. デバッグログでボトルネックを特定
 * 
 * 推奨ブレークポイント:
 * - 11行目: fibonacciSlowの入口（呼び出し頻度の確認）
 * - 18行目: fibonacciFastの入口（キャッシュヒット率の確認）
 * - 34行目: パフォーマンス測定ループ
 * - 42行目: 遅い処理の警告条件
 */