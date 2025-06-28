// 値の変化を確認するデモプログラム
console.log('=== 値の変化デモ開始 ===\n');

// 1. 基本的な値の変化
let count = 0;
console.log('初期値: count =', count);

count = 10;
console.log('代入後: count =', count);

count = count + 5;
console.log('加算後: count =', count);

count = count * 2;
console.log('乗算後: count =', count);

// 2. オブジェクトの変化
console.log('\n--- オブジェクトの変化 ---');
let user = { name: 'Alice', age: 25 };
console.log('初期値: user =', JSON.stringify(user));

user.age = 26;
console.log('年齢変更後: user =', JSON.stringify(user));

user.email = 'alice@example.com';
console.log('メール追加後: user =', JSON.stringify(user));

// 3. 配列の変化
console.log('\n--- 配列の変化 ---');
let numbers = [1, 2, 3];
console.log('初期値: numbers =', numbers);

numbers.push(4);
console.log('push後: numbers =', numbers);

numbers[0] = 10;
console.log('要素変更後: numbers =', numbers);

// 4. ループ内での変化
console.log('\n--- ループ内での変化 ---');
let sum = 0;
for (let i = 1; i <= 5; i++) {
    sum = sum + i;
    console.log(`ループ ${i}: sum = ${sum}`);
}

// 5. 関数内での変化
console.log('\n--- 関数内での変化 ---');
function updateValue(val) {
    console.log('  関数開始: val =', val);
    val = val * 2;
    console.log('  関数内で変更: val =', val);
    return val;
}

let result = updateValue(count);
console.log('関数の戻り値: result =', result);
console.log('元の値は変化なし: count =', count);

console.log('\n=== デモ終了 ===');