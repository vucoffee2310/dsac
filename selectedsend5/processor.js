import { addClickedCard, clearClickedCards } from './lib/state.js';
import { renderCards, handleFileSelect } from './lib/utils.js';

// --- Configuration ---
// Define the prefix string in its own variable for easy modification.
const PROMPT_PREFIX = `### **1. 基本機能**

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

// --- DOM Elements ---
const grid = document.getElementById('grid');
const fileInput = document.getElementById('fileInput');
const clearSavedBtn = document.getElementById('clearSaved');
const batchOpenBtn = document.getElementById('batchOpenBtn');
const batchOpenCountInput = document.getElementById('batchOpenCount');
const themeSwitcher = document.getElementById('themeSwitcher');


// -------------------------------------------------------------------
// --- THEME MANAGEMENT LOGIC ---
// -------------------------------------------------------------------
const themeStorageKey = 'selectedsend-theme';

/**
 * Applies the selected theme to the document and updates button states.
 * @param {string} theme - The theme to apply ('light', 'dark', or 'system').
 */
function applyTheme(theme) {
    const root = document.documentElement;
    let effectiveTheme = theme;

    // If 'system' is chosen, determine the actual theme from browser settings.
    if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Set the data-theme attribute on the <html> element to trigger CSS changes.
    root.setAttribute('data-theme', effectiveTheme);
    
    // Update the UI to show which theme button is currently active.
    themeSwitcher.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

/**
 * Initializes the theme on page load and sets up the event listener for the theme switcher.
 */
function initTheme() {
    // 1. Get the saved theme from localStorage, defaulting to 'system'.
    const savedTheme = localStorage.getItem(themeStorageKey) || 'system';
    applyTheme(savedTheme);

    // 2. Add a single event listener to the switcher container.
    themeSwitcher.addEventListener('click', (e) => {
        const themeButton = e.target.closest('.theme-btn');
        if (themeButton) {
            const newTheme = themeButton.dataset.theme;
            // Save the user's choice and apply the new theme.
            localStorage.setItem(themeStorageKey, newTheme);
            applyTheme(newTheme);
        }
    });
}

// -------------------------------------------------------------------
// --- CORE EXTENSION FUNCTIONALITY ---
// -------------------------------------------------------------------
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function openCard(card) {
  if (!card || card.classList.contains('card-clicked')) return;
  
  card.classList.add('card-clicked');
  const { id, name, content } = card.dataset;
  await addClickedCard(id);

  // Format the card content into a minified JSON array.
  const lines = content.split('\n');
  const minifiedLines = lines.map(line => line.trim()).filter(line => line);
  const arrayFormattedContent = JSON.stringify(minifiedLines);
  
  // Prepend the prefix to the final formatted content.
  const modifiedContent = PROMPT_PREFIX + arrayFormattedContent;

  const newTab = await chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat", active: false });

  chrome.runtime.sendMessage({
    action: "logTabCreation",
    payload: { id: newTab.id, cardName: name, cardContent: modifiedContent }
  });
}

// -------------------------------------------------------------------
// --- INITIALIZATION & EVENT LISTENERS ---
// -------------------------------------------------------------------

// This ensures all the setup code runs only after the HTML page is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the theme switcher logic.
    initTheme();

    // Attach event listener for single card clicks.
    grid.addEventListener('click', async (event) => {
        const card = event.target.closest('.card');
        if (card) await openCard(card);
    });

    // Attach event listener for file selection.
    fileInput.addEventListener('change', (event) => {
        handleFileSelect(event, (lines) => renderCards(grid, lines));
    });

    // Attach event listener for clearing saved card states.
    clearSavedBtn.addEventListener('click', async () => {
        await clearClickedCards();
        alert('✅ Cleared all clicked card states.');
        document.querySelectorAll('.card.card-clicked').forEach(c => c.classList.remove('card-clicked'));
    });

    // Attach event listener for batch opening cards.
    batchOpenBtn.addEventListener('click', async () => {
        const count = parseInt(batchOpenCountInput.value, 10);
        if (isNaN(count) || count <= 0) {
            alert('Please enter a valid number of cards to open.'); return;
        }
        const unclickedCards = grid.querySelectorAll('.card:not(.card-clicked)');
        const cardsToOpen = Array.from(unclickedCards).slice(0, count);
        if (cardsToOpen.length === 0) {
            alert('No unclicked cards available to open.'); return;
        }
        batchOpenBtn.disabled = true;
        batchOpenCountInput.disabled = true;
        for (const card of cardsToOpen) {
            await openCard(card);
            await wait(200);
        }
        batchOpenBtn.disabled = false;
        batchOpenCountInput.disabled = false;
    });
});