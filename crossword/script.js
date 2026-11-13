const translations = {
  en: {
    eyebrow: "A LITTLE WORD PRACTICE",
    title: "Crossword English",
    subtitle: "Use the meanings to fill in the words.",
    wordsPageLink: "Word list",
    settingsLink: "Settings",
    check: "Check answers",
    showAnswers: "Show answers",
    saveGame: "Save game",
    loadGame: "Load saved game",
    newPuzzle: "New puzzle",
    boardTitle: "Puzzle",
    across: "Across",
    down: "Down",
    footer: "Words are selected from the included vocabulary list.",
    progress: "{filled} of {total} letters filled",
    loading: "Loading the word list…",
    loadError: "Could not load the word list. Run this page from a local web server.",
    noWords: "No usable words were found in word_list.json.",
    checked: "{correct} of {total} words are correct.",
    complete: "Excellent! You completed the crossword.",
    answersShown: "The answers are shown.",
    gameSaved: "Game saved in this browser.",
    gameLoaded: "Saved game loaded.",
    noSavedGame: "There is no saved game in this browser.",
    saveError: "Could not save the game. The browser may not allow cookies or the save may be too large.",
    invalidSave: "Could not load the saved game because its data is invalid.",
    puzzleReady: "New crossword ready. Fill the numbered squares using the clues.",
    allWordsLearned: "All words at this level are marked as learned. Choose another level or unmark some words.",
    correctProgress: "Recorded {count} correct answers in your learning progress.",
    progressSaveError: "Could not save word-learning progress in a browser cookie.",
    unsavedChanges: "This puzzle has unsaved changes. Leave this page anyway?",
    clueMeaningMissing: "Meaning unavailable",
    letter: "letter",
    letters: "letters"
  },
  zh: {
    eyebrow: "每日英语词汇练习",
    title: "英语填字游戏",
    subtitle: "根据释义填写单词。",
    wordsPageLink: "词汇表",
    settingsLink: "设置",
    check: "检查答案",
    showAnswers: "显示答案",
    saveGame: "保存游戏",
    loadGame: "加载已保存游戏",
    newPuzzle: "新谜题",
    boardTitle: "填字盘",
    across: "横向",
    down: "纵向",
    footer: "单词选自随附的词汇表。",
    progress: "已填写 {filled} / {total} 个字母",
    loading: "正在加载词汇表…",
    loadError: "无法加载词汇表，请通过本地网页服务器打开此页面。",
    noWords: "word_list.json 中没有可用的单词。",
    checked: "{correct} / {total} 个单词正确。",
    complete: "太棒了！你完成了填字游戏。",
    answersShown: "答案已显示。",
    gameSaved: "游戏已保存到此浏览器。",
    gameLoaded: "已加载保存的游戏。",
    noSavedGame: "此浏览器中没有已保存的游戏。",
    saveError: "无法保存游戏。浏览器可能不允许使用 Cookie，或保存数据过大。",
    invalidSave: "保存的数据无效，无法加载游戏。",
    puzzleReady: "新填字游戏已准备好。请根据提示填写带编号的方格。",
    allWordsLearned: "此级别的单词都已标记为学会。请选择其他级别或取消部分标记。",
    correctProgress: "已将 {count} 个正确答案计入学习进度。",
    progressSaveError: "无法将单词学习进度保存到浏览器 Cookie。",
    unsavedChanges: "当前谜题尚未保存，仍要离开此页面吗？",
    clueMeaningMissing: "暂无释义",
    letter: "个字母",
    letters: "个字母"
  }
};

const BOARD_SIZE = 31;
const TARGET_WORDS = 12;
const MAX_WORD_LENGTH = 30;
const SAVE_COOKIE = "crossword-game-save";

const elements = {
  check: document.querySelector("#check-button"),
  showAnswers: document.querySelector("#show-answer-button"),
  save: document.querySelector("#save-button"),
  load: document.querySelector("#load-button"),
  newPuzzle: document.querySelector("#new-button"),
  board: document.querySelector("#crossword"),
  across: document.querySelector("#across-clues"),
  down: document.querySelector("#down-clues"),
  status: document.querySelector("#game-status"),
  progress: document.querySelector("#progress")
};

let locale = "en";
let englishVariant = "us";
let wordBank = [];
let wordKeys = [];
let currentWordList = "word_list.json";
let currentWordLevel = "all";
let correctCounts = new Uint8Array();
let learnedWords = new Uint8Array();
let countedWords = new Set();
let currentPuzzle = null;
let activeWord = null;
let answersRevealed = false;
let gameSaved = false;
let showChineseMeanings = false;

function text(key, values = {}) {
  return Object.entries(values)
    .reduce((message, [name, value]) => message.replaceAll(`{${name}}`, value), translations[locale][key]);
}

function setLocale(language) {
  locale = language;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translations[locale][node.dataset.i18n];
  });
  if (answersRevealed) elements.status.textContent = text("answersShown");
  if (currentPuzzle) renderClues();
  updateProgress();
}

function cleanWord(entry) {
  if (!entry) return "";
  const spelling = englishVariant === "uk"
    ? entry.spelling_uk || entry.word_uk || entry.word
    : entry.spelling_us || entry.word_us || entry.word;
  return typeof spelling === "string" ? spelling.toUpperCase().replace(/[^A-Z]/g, "") : "";
}

function prepareWords(entries) {
  const firstIndexByAnswer = new Map();
  return entries.flatMap((entry, sourceIndex) => {
    if (currentWordLevel !== "all" && entry?.level !== currentWordLevel) return [];
    const answer = cleanWord(entry);
    if (!answer || answer.length > MAX_WORD_LENGTH) return [];
    if (!firstIndexByAnswer.has(answer)) firstIndexByAnswer.set(answer, sourceIndex);
    return [{
      answer,
      sourceIndex: firstIndexByAnswer.get(answer),
      displayWord: englishVariant === "uk"
        ? entry.spelling_uk || entry.word_uk || entry.word
        : entry.spelling_us || entry.word_us || entry.word,
      pos: typeof entry.pos === "string" ? entry.pos : "",
      definitionEn: typeof entry.meaning_en === "string"
        ? entry.meaning_en
        : typeof entry.definition_en === "string" ? entry.definition_en : "",
      definitionZh: typeof entry.meaning_zh === "string"
        ? entry.meaning_zh
        : typeof entry.definition_zh === "string" ? entry.definition_zh : ""
    }];
  });
}

function shuffled(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function chooseWords() {
  const buckets = new Map();
  const seen = new Set();
  for (const word of wordBank) {
    if (seen.has(word.answer)) continue;
    seen.add(word.answer);
    if (correctCounts[word.sourceIndex] >= 3 || learnedWords[word.sourceIndex]) continue;
    const length = word.answer.length;
    if (!buckets.has(length)) buckets.set(length, []);
    buckets.get(length).push(word);
  }
  for (const [length, words] of buckets) buckets.set(length, shuffled(words));

  const lengths = [...buckets.keys()].sort((a, b) => a - b);
  const selected = [];
  while (selected.length < 180) {
    let added = false;
    for (const length of lengths) {
      const word = buckets.get(length).pop();
      if (word) {
        selected.push(word);
        added = true;
      }
      if (selected.length === 180) break;
    }
    if (!added) break;
  }
  return shuffled(selected);
}

function makeGrid() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function placementIsValid(grid, word, row, col, direction) {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;
  const endRow = row + dr * (word.answer.length - 1);
  const endCol = col + dc * (word.answer.length - 1);
  if (row < 0 || col < 0 || endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) return null;

  const beforeRow = row - dr;
  const beforeCol = col - dc;
  const afterRow = endRow + dr;
  const afterCol = endCol + dc;
  if ((grid[beforeRow]?.[beforeCol]) || (grid[afterRow]?.[afterCol])) return null;

  let crossings = 0;
  for (let i = 0; i < word.answer.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid[r][c];
    if (existing && existing.letter !== word.answer[i]) return null;
    if (existing) {
      crossings += 1;
    } else {
      const sideCells = direction === "across"
        ? [[r - 1, c], [r + 1, c]]
        : [[r, c - 1], [r, c + 1]];
      if (sideCells.some(([sideRow, sideCol]) => grid[sideRow]?.[sideCol])) return null;
    }
  }
  return crossings > 0 ? crossings : null;
}

function findPlacements(grid, placedWords, word) {
  const options = [];
  for (const placed of placedWords) {
    const direction = placed.direction === "across" ? "down" : "across";
    const placedDr = placed.direction === "down" ? 1 : 0;
    const placedDc = placed.direction === "across" ? 1 : 0;
    for (let placedIndex = 0; placedIndex < placed.answer.length; placedIndex += 1) {
      const row = placed.row + placedDr * placedIndex;
      const col = placed.col + placedDc * placedIndex;
      const letter = placed.answer[placedIndex];
      for (let wordIndex = 0; wordIndex < word.answer.length; wordIndex += 1) {
        if (word.answer[wordIndex] !== letter) continue;
        const startRow = row - (direction === "down" ? wordIndex : 0);
        const startCol = col - (direction === "across" ? wordIndex : 0);
        const crossings = placementIsValid(grid, word, startRow, startCol, direction);
        if (crossings) options.push({ row: startRow, col: startCol, direction, crossings });
      }
    }
  }
  return options;
}

function writePlacement(grid, word, placement) {
  const dr = placement.direction === "down" ? 1 : 0;
  const dc = placement.direction === "across" ? 1 : 0;
  const placedWord = { ...word, ...placement };
  for (let i = 0; i < word.answer.length; i += 1) {
    const row = placement.row + dr * i;
    const col = placement.col + dc * i;
    if (!grid[row][col]) grid[row][col] = { letter: word.answer[i], across: null, down: null };
    grid[row][col][placement.direction] = placedWord;
  }
  return placedWord;
}

function generatePuzzle() {
  const candidates = chooseWords();
  if (!candidates.length) return null;
  const firstPool = candidates.filter((word) => word.answer.length >= 4);
  const root = shuffled(firstPool.length ? firstPool : candidates)[0];
  const grid = makeGrid();
  const rootPlacement = {
    row: Math.floor((BOARD_SIZE - 1) / 2),
    col: Math.floor((BOARD_SIZE - root.answer.length) / 2),
    direction: "across"
  };
  const placedWords = [writePlacement(grid, root, rootPlacement)];
  const used = new Set([root.answer]);
  const remaining = shuffled(candidates.filter((word) => !used.has(word.answer)));

  for (const word of remaining) {
    if (placedWords.length >= TARGET_WORDS) break;
    const options = findPlacements(grid, placedWords, word);
    if (!options.length) continue;
    const bestCrossings = Math.max(...options.map((option) => option.crossings));
    const bestOptions = options.filter((option) => option.crossings === bestCrossings);
    const placement = bestOptions[Math.floor(Math.random() * bestOptions.length)];
    placedWords.push(writePlacement(grid, word, placement));
    used.add(word.answer);
  }
  assignNumbers(grid);
  return { grid, words: placedWords };
}

function assignNumbers(grid) {
  let number = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = grid[row][col];
      if (!cell) continue;
      const startsAcross = !grid[row][col - 1] && Boolean(cell.across);
      const startsDown = !grid[row - 1]?.[col] && Boolean(cell.down);
      if (!startsAcross && !startsDown) continue;
      number += 1;
      cell.number = number;
      if (startsAcross) cell.across.number = number;
      if (startsDown) cell.down.number = number;
    }
  }
}

function renderBoard() {
  elements.board.replaceChildren();
  elements.board.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, var(--cell-size))`;
  elements.board.setAttribute("aria-rowcount", String(BOARD_SIZE));
  elements.board.setAttribute("aria-colcount", String(BOARD_SIZE));

  currentPuzzle.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const wrapper = document.createElement("div");
      wrapper.className = "cell";
      if (!cell) {
        wrapper.setAttribute("aria-hidden", "true");
      } else {
        wrapper.setAttribute("role", "gridcell");
        if (cell.number) {
          const number = document.createElement("span");
          number.className = "cell-number";
          number.textContent = cell.number;
          wrapper.append(number);
        }
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.autocomplete = "off";
        input.autocapitalize = "characters";
        input.spellcheck = false;
        input.dataset.row = rowIndex;
        input.dataset.col = colIndex;
        input.setAttribute("aria-label", `${cell.number || ""} ${locale === "en" ? "letter" : "字母"}`);
        input.addEventListener("input", onCellInput);
        input.addEventListener("keydown", onCellKeydown);
        wrapper.append(input);
      }
      elements.board.append(wrapper);
    });
  });
}

function sortedClues(direction) {
  return currentPuzzle.words
    .filter((word) => word.direction === direction)
    .sort((a, b) => a.number - b.number);
}

function renderClues() {
  for (const [direction, list] of [["across", elements.across], ["down", elements.down]]) {
    list.replaceChildren();
    for (const word of sortedClues(direction)) {
      const item = document.createElement("li");
      item.value = word.number;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clue-button";
      button.dataset.answer = word.answer;
      button.dataset.direction = direction;
      const meaning = showChineseMeanings ? word.definitionZh : word.definitionEn;
      const lengthLabel = word.answer.length === 1 ? text("letter") : text("letters");
      button.textContent = `${word.pos ? `${word.pos} ` : ""}${meaning || text("clueMeaningMissing")} (${word.answer.length} ${lengthLabel})`;
      button.addEventListener("click", () => focusWord(word));
      item.append(button);
      list.append(item);
    }
  }
  updateProgress();
}

function wordInputs(word) {
  const dr = word.direction === "down" ? 1 : 0;
  const dc = word.direction === "across" ? 1 : 0;
  return Array.from({ length: word.answer.length }, (_, index) =>
    elements.board.querySelector(`input[data-row="${word.row + dr * index}"][data-col="${word.col + dc * index}"]`));
}

function focusWord(word, startIndex = 0) {
  const inputs = wordInputs(word);
  activeWord = word;
  inputs[startIndex]?.focus();
  inputs[startIndex]?.select();
}

function allInputs() {
  return Array.from(elements.board.querySelectorAll("input"));
}

function nextInput(input, delta) {
  const inputs = allInputs();
  const index = inputs.indexOf(input);
  inputs[index + delta]?.focus();
}

function onCellInput(event) {
  const input = event.currentTarget;
  gameSaved = false;
  input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
  input.classList.remove("correct", "incorrect");
  if (input.value) {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    const matchingWord = activeWord && wordInputs(activeWord).includes(input)
      ? activeWord
      : currentPuzzle.words.find((word) => word.direction === "across" && wordInputs(word).includes(input))
        || currentPuzzle.words.find((word) => word.direction === "down" && wordInputs(word).includes(input));
    if (matchingWord) {
      activeWord = matchingWord;
      const currentIndex = wordInputs(matchingWord).indexOf(input);
      const next = wordInputs(matchingWord)[currentIndex + 1];
      next?.focus();
      next?.select();
    } else {
      const fallback = elements.board.querySelector(`input[data-row="${row}"][data-col="${col + 1}"]`);
      fallback?.focus();
    }
  }
  updateProgress();
  updateSolvedClues();
}

function onCellKeydown(event) {
  const input = event.currentTarget;
  if (event.key === "Backspace" && !input.value) {
    event.preventDefault();
    const index = activeWord ? wordInputs(activeWord).indexOf(input) : -1;
    if (index > 0) wordInputs(activeWord)[index - 1].focus();
    else nextInput(input, -1);
  } else if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const row = Number(input.dataset.row) + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0);
    const col = Number(input.dataset.col) + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0);
    const target = elements.board.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
    if (target) {
      if (activeWord && !wordInputs(activeWord).includes(target)) activeWord = null;
      target.focus();
    }
  }
}

function updateProgress() {
  if (!currentPuzzle) return;
  const inputs = allInputs();
  const filled = inputs.filter((input) => input.value).length;
  elements.progress.textContent = text("progress", { filled, total: inputs.length });
}

function isWordCorrect(word) {
  const inputs = wordInputs(word);
  return inputs.every((input, index) => input && input.value === word.answer[index]);
}

function updateSolvedClues() {
  for (const button of document.querySelectorAll(".clue-button")) {
    const word = currentPuzzle.words.find((candidate) =>
      candidate.answer === button.dataset.answer && candidate.direction === button.dataset.direction);
    button.classList.toggle("solved", Boolean(word && isWordCorrect(word)));
  }
}

function checkAnswers() {
  let correctWords = 0;
  const newlyCounted = [];
  for (const word of currentPuzzle.words) {
    const inputs = wordInputs(word);
    const correct = isWordCorrect(word);
    if (correct) {
      correctWords += 1;
      const wordIndex = wordBank.findIndex((entry) => entry.answer === word.answer);
      const sourceIndex = wordIndex >= 0 ? wordBank[wordIndex].sourceIndex : -1;
      if (!answersRevealed && sourceIndex >= 0 && !countedWords.has(sourceIndex)) {
        countedWords.add(sourceIndex);
        correctCounts[sourceIndex] = Math.min(3, correctCounts[sourceIndex] + 1);
        newlyCounted.push(sourceIndex);
      }
    }
    inputs.forEach((input, index) => {
      input.classList.remove("correct", "incorrect");
      if (input.value) input.classList.add(input.value === word.answer[index] ? "correct" : "incorrect");
    });
  }
  const complete = correctWords === currentPuzzle.words.length;
  if (newlyCounted.length > 0) {
    if (!saveProgress()) {
      for (const wordIndex of newlyCounted) {
        countedWords.delete(wordIndex);
        correctCounts[wordIndex] -= 1;
      }
      elements.status.textContent = text("progressSaveError");
      elements.status.className = "game-status error";
      return;
    }
    elements.status.textContent = `${text("correctProgress", { count: newlyCounted.length })} ${complete ? text("complete") : text("checked", { correct: correctWords, total: currentPuzzle.words.length })}`;
  } else {
    elements.status.textContent = complete
      ? text("complete")
      : text("checked", { correct: correctWords, total: currentPuzzle.words.length });
  }
  elements.status.className = `game-status ${complete ? "success" : ""}`;
}

function showAnswers() {
  answersRevealed = true;
  gameSaved = false;
  for (const word of currentPuzzle.words) {
    wordInputs(word).forEach((input, index) => {
      input.value = word.answer[index];
      input.classList.remove("incorrect");
      input.classList.add("correct");
    });
  }
  updateProgress();
  updateSolvedClues();
  elements.status.textContent = text("answersShown");
  elements.status.className = "game-status success";
}

function startNewPuzzle() {
  currentPuzzle = generatePuzzle();
  activeWord = null;
  countedWords = new Set();
  answersRevealed = false;
  gameSaved = false;
  elements.status.className = "game-status";
  if (!currentPuzzle) {
    elements.board.replaceChildren();
    elements.across.replaceChildren();
    elements.down.replaceChildren();
    elements.progress.textContent = "";
    const hasAvailableWord = wordBank.some((_, index) => correctCounts[index] < 3 && !learnedWords[index]);
    elements.status.textContent = wordBank.length && !hasAvailableWord
      ? text("allWordsLearned")
      : text("noWords");
    return;
  }
  renderBoard();
  renderClues();
  elements.status.textContent = text("puzzleReady");
}

function saveProgress() {
  return window.CrosswordStorage.writeProgress(currentWordList, correctCounts, learnedWords, wordKeys);
}

function legacyProgressIndices() {
  return [...new Set(wordBank.map((word) => word.sourceIndex))];
}

function saveGame() {
  if (!currentPuzzle) return;
  const words = currentPuzzle.words.map((word) => [
    word.sourceIndex,
    word.row,
    word.col,
    word.direction
  ]);
  if (words.some(([wordIndex]) => wordIndex < 0)) {
    elements.status.textContent = text("saveError");
    elements.status.className = "game-status error";
    return;
  }

  const letters = allInputs()
    .filter((input) => input.value)
    .map((input) => [
      Number(input.dataset.row) * BOARD_SIZE + Number(input.dataset.col),
      input.value
    ]);
  const save = {
    version: 1,
    wordList: currentWordList,
    wordLevel: currentWordLevel,
    words,
    letters,
    counted: [...countedWords]
  };
  if (!window.CrosswordStorage.setCookie(SAVE_COOKIE, JSON.stringify(save))) {
    elements.status.textContent = text("saveError");
    elements.status.className = "game-status error";
    return;
  }
  gameSaved = true;
  elements.status.textContent = text("gameSaved");
  elements.status.className = "game-status success";
}

function isValidSave(save) {
  return save
    && save.version === 1
    && save.wordList === currentWordList
    && (save.wordLevel === undefined || save.wordLevel === currentWordLevel)
    && Array.isArray(save.words)
    && save.words.length > 0
    && save.words.every((placement) =>
      Array.isArray(placement)
      && placement.length === 4
      && Number.isInteger(placement[0])
      && placement[0] >= 0
      && wordBank.some((entry) => entry.sourceIndex === placement[0])
      && Number.isInteger(placement[1])
      && Number.isInteger(placement[2])
      && (placement[3] === "across" || placement[3] === "down"))
    && Array.isArray(save.letters)
    && save.letters.every((letter) =>
      Array.isArray(letter)
      && Number.isInteger(letter[0])
      && letter[0] >= 0
      && letter[0] < BOARD_SIZE * BOARD_SIZE
      && typeof letter[1] === "string"
      && /^[A-Z]$/.test(letter[1]))
    && Array.isArray(save.counted)
    && save.counted.every((wordIndex) =>
      Number.isInteger(wordIndex) && wordIndex >= 0 && wordIndex < correctCounts.length)
    && (save.showChinese === undefined || typeof save.showChinese === "boolean")
    && (save.locale === undefined || save.locale === "en" || save.locale === "zh");
}

async function loadGame() {
  const raw = window.CrosswordStorage.getCookie(SAVE_COOKIE);
  if (!raw) {
    elements.status.textContent = text("noSavedGame");
    elements.status.className = "game-status";
    return;
  }

  try {
    const save = JSON.parse(raw);
    if (!save.wordList) save.wordList = "word_list.json";
    if (!save.wordLevel) save.wordLevel = currentWordLevel;
    if (!save.counted) save.counted = [];
    if (save.wordList !== currentWordList) throw new Error("Saved word list is unavailable");
    if (save.wordLevel !== currentWordLevel) await selectWordList(false, save.wordLevel);
    if (!isValidSave(save)) throw new Error("Invalid saved game structure");

    const grid = makeGrid();
    const words = save.words.map(([wordIndex, row, col, direction]) => {
      const word = wordBank.find((entry) => entry.sourceIndex === wordIndex);
      if (!word) throw new Error("Saved word is not in the current word list");
      const endRow = row + (direction === "down" ? word.answer.length - 1 : 0);
      const endCol = col + (direction === "across" ? word.answer.length - 1 : 0);
      if (row < 0 || col < 0 || endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) {
        throw new Error("Saved word is outside the puzzle grid");
      }

      for (let index = 0; index < word.answer.length; index += 1) {
        const cellRow = row + (direction === "down" ? index : 0);
        const cellCol = col + (direction === "across" ? index : 0);
        if (grid[cellRow][cellCol] && grid[cellRow][cellCol].letter !== word.answer[index]) {
          throw new Error("Saved words do not fit together");
        }
      }
      return writePlacement(grid, word, { row, col, direction });
    });

    for (const [position] of save.letters) {
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      if (!grid[row][col]) throw new Error("Saved letter is not on a playable square");
    }

    assignNumbers(grid);
    currentPuzzle = { grid, words };
    activeWord = null;
    countedWords = new Set(save.counted);
    answersRevealed = false;
    setLocale(locale);
    renderBoard();
    renderClues();

    for (const [position, value] of save.letters) {
      const row = Math.floor(position / BOARD_SIZE);
      const col = position % BOARD_SIZE;
      const input = elements.board.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
      input.value = value;
    }

    gameSaved = true;
    updateProgress();
    updateSolvedClues();
    elements.status.textContent = text("gameLoaded");
    elements.status.className = "game-status success";
  } catch (error) {
    console.error("Unable to load saved crossword:", error);
    elements.status.textContent = text("invalidSave");
    elements.status.className = "game-status error";
  }
}

async function fetchWordList(filename) {
  const response = await fetch(`./${filename}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${filename}: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.words)) throw new Error(`${filename} has no words array`);
  return data;
}

async function selectWordList(confirmUnsaved = true, requestedLevel) {
  const filename = currentWordList;
  if (confirmUnsaved && currentPuzzle && !gameSaved && !window.confirm(text("unsavedChanges"))) {
    return;
  }
  elements.status.className = "game-status";
  elements.status.textContent = text("loading");
  try {
    const data = await fetchWordList(filename);
    currentWordList = filename;
    const levels = Array.isArray(data.meta?.levels)
      ? data.meta.levels.map((level) => level?.key).filter((level) => typeof level === "string")
      : [...new Set(data.words.map((entry) => entry?.level).filter((level) => typeof level === "string"))];
    const settings = window.CrosswordStorage.readSettings();
    const selectedLevel = requestedLevel || settings.wordLevel;
    currentWordLevel = levels.includes(selectedLevel) ? selectedLevel : levels[0] || "all";
    wordBank = prepareWords(data.words);
    const savedProgress = window.CrosswordStorage.readProgress(
      filename,
      data.words.length,
      legacyProgressIndices(),
      data.words.map((entry) => entry?.word || "")
    );
    correctCounts = savedProgress.correctCounts;
    learnedWords = savedProgress.learned;
    wordKeys = data.words.map((entry) => entry?.word || "");
    if (settings.wordList !== filename || settings.wordLevel !== currentWordLevel) {
      if (!window.CrosswordStorage.writeSettings({ ...settings, wordList: filename, wordLevel: currentWordLevel })) {
        throw new Error("Unable to save the selected vocabulary level");
      }
    }
    startNewPuzzle();
  } catch (error) {
    console.error(`Unable to select word list ${filename}:`, error);
    elements.status.textContent = text("loadError");
    elements.status.className = "game-status error";
  }
}

async function initializeWordList() {
  const settings = window.CrosswordStorage.readSettings();
  if (settings.wordList !== currentWordList
    && !window.CrosswordStorage.writeSettings({ ...settings, wordList: currentWordList })) {
    throw new Error("Unable to save the configured word list");
  }
  await selectWordList(false);
}

elements.check.addEventListener("click", checkAnswers);
elements.showAnswers.addEventListener("click", showAnswers);
elements.save.addEventListener("click", saveGame);
elements.load.addEventListener("click", loadGame);
elements.newPuzzle.addEventListener("click", startNewPuzzle);
window.addEventListener("beforeunload", (event) => {
  if (currentPuzzle && !gameSaved) {
    event.preventDefault();
    event.returnValue = "";
  }
});

const savedSettings = window.CrosswordStorage.readSettings();
locale = savedSettings.locale === "zh" ? "zh" : "en";
englishVariant = savedSettings.englishVariant === "uk" ? "uk" : "us";
showChineseMeanings = savedSettings.showChinese === true;
document.documentElement.dataset.theme = savedSettings.theme === "dark" ? "dark" : "light";
window.CrosswordStorage.applyAppearance(savedSettings);
setLocale(locale);
elements.status.textContent = text("loading");
initializeWordList().catch((error) => {
  console.error("Unable to initialize crossword word lists:", error);
  elements.status.textContent = text("loadError");
  elements.status.className = "game-status error";
});
