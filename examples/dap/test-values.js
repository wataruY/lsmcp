// DAP-DEV MCPで値の変化を確認するためのテストプログラム

function testVariableChanges() {
    // 初期値の設定
    let counter = 0;
    let message = "initial";
    let numbers = [1, 2, 3];
    let obj = { name: "test", count: 0 };

    console.log("Starting test...");

    // 値を段階的に変更
    counter = 1;  // ブレークポイント 1: counterが0から1に変更
    console.log("Counter:", counter);

    message = "updated";  // ブレークポイント 2: messageが変更
    console.log("Message:", message);

    numbers.push(4);  // ブレークポイント 3: 配列に要素追加
    console.log("Numbers:", numbers);

    obj.count = 10;  // ブレークポイント 4: オブジェクトのプロパティ変更
    obj.status = "active";  // 新しいプロパティ追加
    console.log("Object:", obj);

    // ループで値を変化させる
    for (let i = 0; i < 3; i++) {
        counter += i;  // ブレークポイント 5: ループ内での値変化
        console.log(`Loop ${i}: counter = ${counter}`);
    }

    // 関数内での値の変化
    function inner(value) {
        let local = value * 2;  // ブレークポイント 6: ローカル変数
        return local;
    }

    let result = inner(counter);
    console.log("Result:", result);

    return {
        counter,
        message,
        numbers,
        obj,
        result
    };
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    const finalValues = testVariableChanges();
    console.log("\nFinal values:", finalValues);
}

export { testVariableChanges };