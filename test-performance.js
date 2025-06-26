"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Performance comparison: grep vs symbol index
const perf_hooks_1 = require("perf_hooks");
const tsSearchSymbols_ts_1 = require("./src/ts/tools/tsSearchSymbols.ts");
const tsFindImportCandidates_ts_1 = require("./src/ts/tools/tsFindImportCandidates.ts");
const child_process_1 = require("child_process");
const root = process.cwd();
async function testSymbolSearch() {
    console.log('🔍 Testing symbol search performance...\n');
    // Test 1: Search using grep
    console.log('1. Using grep:');
    const grepStart = perf_hooks_1.performance.now();
    try {
        const grepResult = (0, child_process_1.execSync)(`rg -l "class.*Project" --type ts src/`, { encoding: 'utf-8', cwd: root });
        const grepEnd = perf_hooks_1.performance.now();
        console.log(`   Time: ${(grepEnd - grepStart).toFixed(2)}ms`);
        console.log(`   Files found: ${grepResult.split('\n').filter(Boolean).length}`);
    }
    catch (e) {
        console.log('   Error running grep');
    }
    // Test 2: Search using symbol index (first run - builds index)
    console.log('\n2. Using symbol index (first run - builds index):');
    const indexStart1 = perf_hooks_1.performance.now();
    const result1 = await tsSearchSymbols_ts_1.searchSymbolsTool.execute({
        root,
        query: 'Project',
        kinds: ['Class'],
        buildIndex: true,
    });
    const indexEnd1 = perf_hooks_1.performance.now();
    console.log(`   Time: ${(indexEnd1 - indexStart1).toFixed(2)}ms`);
    const matches1 = result1.match(/✓/g)?.length || 0;
    console.log(`   Symbols found: ${matches1}`);
    // Test 3: Search using symbol index (cached)
    console.log('\n3. Using symbol index (cached):');
    const indexStart2 = perf_hooks_1.performance.now();
    const result2 = await tsSearchSymbols_ts_1.searchSymbolsTool.execute({
        root,
        query: 'Project',
        kinds: ['Class'],
        buildIndex: false,
    });
    const indexEnd2 = perf_hooks_1.performance.now();
    console.log(`   Time: ${(indexEnd2 - indexStart2).toFixed(2)}ms`);
    // Test 4: Find import candidates
    console.log('\n4. Finding import candidates for "Project":');
    const importStart = perf_hooks_1.performance.now();
    const importResult = await tsFindImportCandidates_ts_1.findImportCandidatesTool.execute({
        root,
        symbolName: 'Project',
        currentFile: 'src/test.ts',
    });
    const importEnd = perf_hooks_1.performance.now();
    console.log(`   Time: ${(importEnd - importStart).toFixed(2)}ms`);
    const importMatches = importResult.match(/📦/g)?.length || 0;
    console.log(`   Candidates found: ${importMatches}`);
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Symbol index is ${((indexEnd1 - indexStart1) / (grepEnd - grepStart)).toFixed(1)}x slower on first run (includes index building)`);
    console.log(`   Symbol index is ${((grepEnd - grepStart) / (indexEnd2 - indexStart2)).toFixed(1)}x faster on subsequent runs (using cache)`);
    console.log('   Symbol index provides richer information (kind, exports, documentation)');
}
testSymbolSearch().catch(console.error);
