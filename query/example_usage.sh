#!/bin/bash

# 関数シグネチャのみを抽出（ボディなし）
sg --pattern 'function $NAME($$$PARAMS): $RETURN_TYPE' -l typescript

# 関数シグネチャを抽出して、最初の行だけ表示
sg --pattern 'function $NAME($$$PARAMS): $RETURN_TYPE { $$$BODY }' -l typescript | while IFS= read -r line; do
  # ファイル名と行番号を抽出
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  
  # 該当行を表示（{より前まで）
  sed -n "${lineno}p" "$file" | sed 's/{.*//'
done

# ast-grepの出力をそのまま使う場合（--jsonオプション使用）
sg --rule query/func_decl.yaml --json | jq -r '.matches[].lines | split("\n")[0]'

# 単純にパターンマッチした行の最初だけを表示
sg --pattern 'function $NAME($$$)' -l typescript --format=oneline