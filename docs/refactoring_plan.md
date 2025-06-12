スネークケースで実装されているが、これを lowerCamelCase に修正する。

ファイ名と一致する関数名と同名の関数を export する。
それぞれの関数は、 `if (import.meta.vitest) {...}` で in source test をするが、

Example

```ts:findSymbol.ts
export function findSymbol() {
  //...
}
```
