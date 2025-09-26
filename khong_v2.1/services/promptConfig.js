// lib/promptConfig.js
export const PROMPT_PREFIX = `### **1. 基本機能**
日本語の単語を入力として受け取り、JSONオブジェクトを出力します。そのオブジェクトは、入力された単語を**「単純語」**または**「複合語」**として分類します。単語が複合語の場合、その構成要素を**再帰的に分解**して示します。構成要素自体が複合語である場合は、その要素もさらに分解されます。
---
### **2. JSON出力の構造**
**A. ルートオブジェクト:**
最上位のオブジェクトは、以下の要素を**必ず**含みます。
*   \`query\` (string): 入力された元の日本語の単語。
*   \`meaning\` (string): 入力単語の簡潔な英語の定義。
*   \`word_type\` (string): 単語の構造を分類します。値は以下の二つのうちのいずれか**でなければなりません**。
    *   \`\\"compound\\"\`: 単語が二つ以上の意味を持つ部分から構成されていることを示します。
    *   \`\\"simple\\"\`: 単語がそれ以上分解できない単一の単位であることを示します（これには独立した単語や接辞も含まれます）。
*   \`breakdown\` (array): 「構成要素オブジェクト」の順序付きリストです。このプロパティは、\`word_type\`が\`\\"compound\\"\`の場合に**のみ**存在します。
**B. 構成要素オブジェクト (\`breakdown\`配列内):**
\`breakdown\`配列内の各オブジェクトは一つの構成要素を表し、ルートオブジェクトと同一の構造を**持たなければなりません**。以下の要素を含みます。
*   \`word\` (string): 構成要素そのものを表す単語（ひらがななどの表音文字で表現）。
*   \`meaning\` (string): 構成要素の簡潔な英語の定義。
*   \`word_type\` (string): 構成要素の構造を分類します（\`\\"simple\\"\`または\`\\"compound\\"\`）。
*   \`breakdown\` (array): さらに下位の構成要素オブジェクトの順序付きリストです。このプロパティは、構成要素の\`word_type\`が\`\\"compound\\"\`の場合に**のみ**存在します。
---
### **3. 例（日本語）**
#### **例1: 単純語**
入力が\`ねこ\`の場合、構造は変わりません。
\`\`\`json
{
  "query": "ねこ",
  "meaning": "Cat",
  "word_type": "simple"
}
\`\`\`
#### **例2: 単純な接辞**
入力が\`お\`の場合、構造は変わりません。
\`\`\`json
{
  "query": "お",
  "meaning": "Honorific prefix",
  "word_type": "simple"
}
\`\`\`
#### **例3: 再帰的な分解を持つ複合語（更新）**
入力が\`わりびきじかん\`の場合、構成要素の\`わりびき\`自体が複合語（\`わり\` + \`ひき\`）です。新しい構造ではこれを反映しています。
\`\`\`json
{
  "query": "わりびきじかん",
  "meaning": "Discount time; happy hour",
  "word_type": "compound",
  "breakdown": [
    {
      "word": "わりびき",
      "meaning": "Discount, reduction",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "わり",
          "meaning": "To split, divide",
          "word_type": "simple"
        },
        {
          "word": "ひき",
          "meaning": "To pull, deduct",
          "word_type": "simple"
        }
      ]
    },
    {
      "word": "じかん",
      "meaning": "Time, hour",
      "word_type": "simple"
    }
  ]
}
\`\`\`
#### **例4: 複雑な再帰的分解（新規）**
入力が\`じどうしゃでんわ\`（自動車電話）の場合、\`じどうしゃ\`（自動車）と\`でんわ\`（電話）の両方が複合語であり、複数の再帰レベルを示しています。
\`\`\`json
{
  "query": "じどうしゃでんわ",
  "meaning": "Car phone",
  "word_type": "compound",
  "breakdown": [
    {
      "word": "じどうしゃ",
      "meaning": "Automobile, car",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "じ",
          "meaning": "Self, own",
          "word_type": "simple"
        },
        {
          "word": "どう",
          "meaning": "Move",
          "word_type": "simple"
        },
        {
          "word": "しゃ",
          "meaning": "Vehicle",
          "word_type": "simple"
        }
      ]
    },
    {
      "word": "でんわ",
      "meaning": "Telephone",
      "word_type": "compound",
      "breakdown": [
        {
          "word": "でん",
          "meaning": "Electric, electricity",
          "word_type": "simple"
        },
        {
          "word": "わ",
          "meaning": "Talk, story",
          "word_type": "simple"
        }
      ]
    }
  ]
}
\`\`\`
### Let's exercise
準備ができました。演習の単語をどうぞ。
`;