// デバッグ用サンプルスクリプト
// このスクリプトはDAP MCPサーバーでデバッグするためのテストプログラムです

// グローバル変数
let globalCounter = 0;

// シンプルな関数
function add(a, b) {
    console.log(`Adding ${a} + ${b}`);
    const result = a + b;
    return result;
}

// オブジェクトを扱う関数
function processUser(user) {
    console.log(`Processing user: ${user.name}`);
    
    // ローカル変数
    const processedData = {
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        age: user.age,
        timestamp: new Date().toISOString()
    };
    
    // ネストした関数呼び出し
    const score = calculateScore(user.age, user.experience);
    processedData.score = score;
    
    return processedData;
}

// スコア計算関数
function calculateScore(age, experience) {
    const baseScore = 100;
    const ageBonus = age * 2;
    const experienceBonus = experience * 10;
    
    // ブレークポイントを設定する良い場所
    const totalScore = baseScore + ageBonus + experienceBonus;
    
    return totalScore;
}

// 非同期関数
async function fetchData(delay) {
    console.log(`Fetching data with ${delay}ms delay...`);
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = {
                timestamp: Date.now(),
                random: Math.random(),
                message: "Data fetched successfully"
            };
            resolve(data);
        }, delay);
    });
}

// エラーハンドリングの例
function riskyOperation(shouldFail) {
    try {
        if (shouldFail) {
            throw new Error("Intentional error for debugging");
        }
        
        return "Operation successful";
    } catch (error) {
        console.error("Error caught:", error.message);
        return null;
    }
}

// メイン実行関数
async function main() {
    console.log("=== Debug Sample Program Started ===");
    
    // 1. 基本的な計算
    const sum = add(5, 3);
    console.log(`Sum: ${sum}`);
    
    // 2. オブジェクト処理
    const user = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        age: 30,
        experience: 5
    };
    
    const processedUser = processUser(user);
    console.log("Processed user:", processedUser);
    
    // 3. 非同期処理
    const asyncData = await fetchData(1000);
    console.log("Async data:", asyncData);
    
    // 4. ループ処理
    console.log("\nLoop processing:");
    for (let i = 0; i < 5; i++) {
        globalCounter++;
        console.log(`Iteration ${i}, globalCounter: ${globalCounter}`);
        
        // 条件付きブレーク
        if (i === 3) {
            console.log("Special condition met at i === 3");
        }
    }
    
    // 5. エラーハンドリング
    console.log("\nError handling test:");
    const result1 = riskyOperation(false);
    console.log("Result 1:", result1);
    
    const result2 = riskyOperation(true);
    console.log("Result 2:", result2);
    
    // 6. 複雑なデータ構造
    const complexData = {
        users: [user],
        metadata: {
            version: "1.0",
            timestamp: new Date()
        },
        stats: {
            total: 1,
            active: 1
        }
    };
    
    console.log("\nComplex data structure:", JSON.stringify(complexData, null, 2));
    
    console.log("\n=== Program Completed ===");
}

// プログラムの実行
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export {
    add,
    processUser,
    calculateScore,
    fetchData,
    riskyOperation
};