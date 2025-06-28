/**
 * 最長共通部分列（Longest Common Subsequence）アルゴリズム
 * DAPデバッグの実例として使用
 * 
 * このアルゴリズムは動的計画法の典型的な例で、デバッグ時に以下の点を観察できます：
 * 1. DPテーブルの構築過程
 * 2. 文字の一致判定
 * 3. バックトラックによる解の復元
 */

function longestCommonSubsequence(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // DPテーブルの初期化
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  console.log(`LCS計算開始: "${str1}" vs "${str2}"`);
  
  // DPテーブルの構築
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // 文字が一致する場合
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        // 文字が一致しない場合
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // LCSの復元
  let lcs = '';
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs = str1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return {
    length: dp[m][n],
    sequence: lcs,
    dpTable: dp
  };
}

// デバッグ用のテストケース
function runTests() {
  const testCases = [
    { str1: 'ABCDGH', str2: 'AEDFHR', expected: 'ADH' },
    { str1: 'AGGTAB', str2: 'GXTXAYB', expected: 'GTAB' },
    { str1: 'programming', str2: 'gaming', expected: 'gaming' }
  ];
  
  for (const test of testCases) {
    console.log(`\nテスト: "${test.str1}" vs "${test.str2}"`);
    const result = longestCommonSubsequence(test.str1, test.str2);
    console.log(`結果: ${result.sequence} (長さ: ${result.length})`);
    console.log(`期待値: ${test.expected}`);
    console.log(`正解: ${result.sequence === test.expected ? '✓' : '✗'}`);
  }
}

// エントリーポイント
if (require.main === module) {
  runTests();
}

module.exports = { longestCommonSubsequence };