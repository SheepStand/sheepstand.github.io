const settingsTranslations = {
  en: {
    eyebrow: "A LITTLE WORD PRACTICE",
    title: "Settings",
    subtitle: "Choose the language and appearance used across the pages.",
    languageLabel: "Interface language",
    themeLabel: "Appearance",
    englishVariantLabel: "English spelling and pronunciation",
    americanEnglish: "American English",
    britishEnglish: "British English",
    wordLevelLabel: "Vocabulary level",
    accentColorLabel: "Page color",
    accentColorLabelUK: "Page colour",
    showChinese: "Show Chinese meanings in clues",
    dataTitle: "Data backup",
    dataSubtitle: "Export or import your saved game, learning progress, and game settings.",
    exportData: "Export data",
    importData: "Import data",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    crosswordLink: "Crossword",
    wordListLink: "Word list",
    saved: "Settings saved.",
    saveError: "Could not save settings in a browser cookie.",
    wordLevelLoadError: "Could not load the available vocabulary levels.",
    levels: {
      primary: "Primary",
      junior: "Junior high",
      senior: "Senior high",
      cet4: "College English Test Band 4",
      cet6: "College English Test Band 6"
    },
    resetSettings: "Reset settings and learning progress",
    resetConfirm: "Reset the interface to English, appearance to Light, English variant to American, turn off Chinese clues, and clear learning progress for every word list? Your saved crossword game will remain.",
    resetSuccess: "Settings and learning progress have been reset.",
    resetError: "Could not reset settings or learning progress in browser storage.",
    exportError: "Could not export saved data.",
    importInvalid: "This file is not a valid crossword data export.",
    importConfirm: "This file is valid. Importing it will replace the saved game, learning progress, and any settings included in the file. Continue?",
    importError: "Could not import the data. Browser storage may be unavailable or full.",
    importSuccess: "Saved game, learning progress, and settings imported."
  },
  zh: {
    eyebrow: "每日英语词汇练习",
    title: "设置",
    subtitle: "选择所有页面使用的语言和外观。",
    languageLabel: "界面语言",
    themeLabel: "外观",
    englishVariantLabel: "英语拼写和发音",
    americanEnglish: "美式英语",
    britishEnglish: "英式英语",
    wordLevelLabel: "词汇级别",
    accentColorLabel: "页面主题色",
    accentColorLabelUK: "页面主题色",
    showChinese: "在提示中显示中文释义",
    dataTitle: "数据备份",
    dataSubtitle: "导出或导入已保存的游戏、学习进度和游戏设置。",
    exportData: "导出数据",
    importData: "导入数据",
    lightTheme: "浅色",
    darkTheme: "深色",
    systemTheme: "跟随系统",
    crosswordLink: "填字游戏",
    wordListLink: "词汇表",
    saved: "设置已保存。",
    saveError: "无法将设置保存到浏览器 Cookie。",
    wordLevelLoadError: "无法加载可用的词汇级别。",
    levels: {},
    resetSettings: "重置设置和学习进度",
    resetConfirm: "将界面重置为英文、外观重置为浅色、英语变体重置为美式、关闭中文提示，并清除所有词表的学习进度？已保存的填字游戏将保留。",
    resetSuccess: "设置和学习进度已重置。",
    resetError: "无法在浏览器存储中重置设置或学习进度。",
    exportError: "无法导出已保存的数据。",
    importInvalid: "此文件不是有效的填字游戏数据备份。",
    importConfirm: "文件格式有效。导入将覆盖已保存的游戏、学习进度以及文件中包含的设置。是否继续？",
    importError: "无法导入数据。浏览器存储可能不可用或空间不足。",
    importSuccess: "已导入保存的游戏、学习进度和设置。"
  }
};

const languageSelector = document.querySelector("#interface-language");
const themeSelector = document.querySelector("#theme-selector");
const englishVariantSelector = document.querySelector("#english-variant");
const wordLevelSelector = document.querySelector("#word-level-selector");
const accentColorSelector = document.querySelector("#accent-color");
const chineseSelector = document.querySelector("#show-chinese");
const statusMessage = document.querySelector("#settings-status");
const exportButton = document.querySelector("#export-data-button");
const importButton = document.querySelector("#import-data-button");
const importFile = document.querySelector("#import-data-file");
const resetButton = document.querySelector("#reset-settings-button");
let availableWordLevels = [];

function applyLanguage(language) {
  const locale = language === "zh" ? "zh" : "en";
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = settingsTranslations[locale][element.dataset.i18n];
  });
  languageSelector.setAttribute("aria-label", settingsTranslations[locale].languageLabel);
  themeSelector.setAttribute("aria-label", settingsTranslations[locale].themeLabel);
  englishVariantSelector.setAttribute("aria-label", settingsTranslations[locale].englishVariantLabel);
  wordLevelSelector.setAttribute("aria-label", settingsTranslations[locale].wordLevelLabel);
  const accentColorLabel = document.querySelector('label[for="accent-color"] span');
  const accentColorText = locale === "en" && englishVariantSelector.value === "uk"
    ? settingsTranslations[locale].accentColorLabelUK
    : settingsTranslations[locale].accentColorLabel;
  accentColorLabel.textContent = accentColorText;
  accentColorSelector.setAttribute("aria-label", accentColorText);
  for (const option of wordLevelSelector.options) {
    const level = availableWordLevels.find((entry) => entry.key === option.value);
    if (level) option.textContent = locale === "zh"
      ? level.name
      : settingsTranslations.en.levels[level.key] || level.name;
  }
  languageSelector.value = locale;
  return locale;
}

function saveSettings() {
  const locale = applyLanguage(languageSelector.value);
  const theme = ["light", "dark", "system"].includes(themeSelector.value) ? themeSelector.value : "light";
  const settings = window.CrosswordStorage.readSettings();
  const updatedSettings = {
    ...settings,
    locale,
    theme,
    wordLevel: wordLevelSelector.value || settings.wordLevel,
    englishVariant: englishVariantSelector.value === "uk" ? "uk" : "us",
    accentColor: accentColorSelector.value,
    showChinese: chineseSelector.checked
  };
  if (!window.CrosswordStorage.writeSettings(updatedSettings)) {
    statusMessage.textContent = settingsTranslations[locale].saveError;
    statusMessage.className = "game-status error";
    return;
  }
  window.CrosswordStorage.applyAppearance(updatedSettings);
  statusMessage.textContent = settingsTranslations[locale].saved;
  statusMessage.className = "game-status success";
}

function exportSavedData() {
  try {
    const data = window.CrosswordStorage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crossword-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    statusMessage.textContent = "";
    statusMessage.className = "game-status";
  } catch (error) {
    console.error("Unable to export saved crossword data:", error);
    const locale = languageSelector.value === "zh" ? "zh" : "en";
    statusMessage.textContent = settingsTranslations[locale].exportError;
    statusMessage.className = "game-status error";
  }
}

async function importSavedData(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (error) {
    console.error("Unable to parse crossword data import:", error);
    data = null;
  }

  const validBackup = window.CrosswordStorage.isValidBackup(data);
  if (!validBackup) {
    const locale = languageSelector.value === "zh" ? "zh" : "en";
    window.alert(settingsTranslations[locale].importInvalid);
    statusMessage.textContent = settingsTranslations[locale].importInvalid;
    statusMessage.className = "game-status error";
    return;
  }
  try {
    const response = await fetch("./word_list.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load word_list.json: HTTP ${response.status}`);
    const list = await response.json();
    if (!list || !Array.isArray(list.words)) throw new Error("word_list.json has no words array");
    const levels = Array.isArray(list.meta?.levels)
      ? list.meta.levels.map((level) => level?.key).filter((level) => typeof level === "string")
      : [...new Set(list.words.map((word) => word?.level).filter((level) => typeof level === "string"))];
    const requestedLevels = [data.settings?.wordLevel, data.savedGame?.wordLevel].filter(Boolean);
    if (requestedLevels.some((level) => !levels.includes(level))) {
      throw new Error("The imported data refers to an unavailable vocabulary level");
    }
  } catch (error) {
    console.error("Imported data refers to an unavailable word list:", error);
    const locale = languageSelector.value === "zh" ? "zh" : "en";
    window.alert(settingsTranslations[locale].importInvalid);
    statusMessage.textContent = settingsTranslations[locale].importInvalid;
    statusMessage.className = "game-status error";
    return;
  }

  const locale = languageSelector.value === "zh" ? "zh" : "en";
  if (!window.confirm(settingsTranslations[locale].importConfirm)) return;
  if (!window.CrosswordStorage.importData(data)) {
    statusMessage.textContent = settingsTranslations[locale].importError;
    statusMessage.className = "game-status error";
    return;
  }

  const importedSettings = window.CrosswordStorage.readSettings();
  languageSelector.value = importedSettings.locale === "zh" ? "zh" : "en";
  themeSelector.value = ["light", "dark", "system"].includes(importedSettings.theme) ? importedSettings.theme : "light";
  englishVariantSelector.value = importedSettings.englishVariant === "uk" ? "uk" : "us";
  accentColorSelector.value = /^#[0-9a-f]{6}$/i.test(importedSettings.accentColor || "")
    ? importedSettings.accentColor
    : "#2563eb";
  chineseSelector.checked = importedSettings.showChinese === true;
  const importedLevel = [...wordLevelSelector.options].some((option) => option.value === importedSettings.wordLevel)
    ? importedSettings.wordLevel
    : wordLevelSelector.options[0]?.value;
  if (importedLevel) {
    wordLevelSelector.value = importedLevel;
    if (importedSettings.wordLevel !== importedLevel
      && !window.CrosswordStorage.writeSettings({ ...importedSettings, wordLevel: importedLevel })) {
      statusMessage.textContent = settingsTranslations[languageSelector.value].importError;
      statusMessage.className = "game-status error";
      return;
    }
  }
  const importedLocale = applyLanguage(languageSelector.value);
  window.CrosswordStorage.applyAppearance(importedSettings);
  statusMessage.textContent = settingsTranslations[importedLocale].importSuccess;
  statusMessage.className = "game-status success";
}

function resetSettingsAndProgress() {
  const locale = languageSelector.value === "zh" ? "zh" : "en";
  if (!window.confirm(settingsTranslations[locale].resetConfirm)) return;

  const currentSettings = window.CrosswordStorage.readSettings();
  const resetSettings = {
    ...currentSettings,
    locale: "en",
    theme: "light",
    englishVariant: "us",
    accentColor: "#2563eb",
    showChinese: false
  };
  if (!window.CrosswordStorage.writeSettings(resetSettings)
    || !window.CrosswordStorage.clearLearningProgress()) {
    statusMessage.textContent = settingsTranslations[locale].resetError;
    statusMessage.className = "game-status error";
    return;
  }

  languageSelector.value = "en";
  themeSelector.value = "light";
  englishVariantSelector.value = "us";
  accentColorSelector.value = "#2563eb";
  chineseSelector.checked = false;
  applyLanguage("en");
  window.CrosswordStorage.applyAppearance(resetSettings);
  statusMessage.textContent = settingsTranslations.en.resetSuccess;
  statusMessage.className = "game-status success";
}

async function loadWordLevels() {
  const response = await fetch("./word_list.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load word_list.json: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.words)) throw new Error("word_list.json has no words array");
  const settings = window.CrosswordStorage.readSettings();
  const metaLevels = Array.isArray(data.meta?.levels) ? data.meta.levels : [];
  availableWordLevels = metaLevels
    .filter((level) => typeof level?.key === "string" && level.key)
    .map((level) => ({ key: level.key, name: typeof level.name === "string" ? level.name : level.key }));
  if (!availableWordLevels.length) {
    availableWordLevels = [...new Set(data.words
      .map((word) => word?.level)
      .filter((level) => typeof level === "string" && level))]
      .map((key) => ({ key, name: key }));
  }
  if (!availableWordLevels.length) availableWordLevels = [{ key: "all", name: "All levels" }];

  for (const level of availableWordLevels) {
    const option = document.createElement("option");
    option.value = level.key;
    wordLevelSelector.append(option);
  }
  const selectedLevel = availableWordLevels.some((level) => level.key === settings.wordLevel)
    ? settings.wordLevel
    : availableWordLevels[0].key;
  wordLevelSelector.value = selectedLevel;
  if (settings.wordList !== "word_list.json" || settings.wordLevel !== selectedLevel) {
    if (!window.CrosswordStorage.writeSettings({ ...settings, wordList: "word_list.json", wordLevel: selectedLevel })) {
      throw new Error("Unable to save the selected vocabulary level");
    }
  }
  applyLanguage(languageSelector.value);
}

const currentSettings = window.CrosswordStorage.readSettings();
languageSelector.value = currentSettings.locale === "zh" ? "zh" : "en";
themeSelector.value = ["light", "dark", "system"].includes(currentSettings.theme) ? currentSettings.theme : "light";
englishVariantSelector.value = currentSettings.englishVariant === "uk" ? "uk" : "us";
accentColorSelector.value = /^#[0-9a-f]{6}$/i.test(currentSettings.accentColor || "")
  ? currentSettings.accentColor
  : "#2563eb";
chineseSelector.checked = currentSettings.showChinese === true;
applyLanguage(languageSelector.value);
window.CrosswordStorage.applyAppearance(currentSettings);

languageSelector.addEventListener("change", saveSettings);
themeSelector.addEventListener("change", saveSettings);
englishVariantSelector.addEventListener("change", saveSettings);
accentColorSelector.addEventListener("input", saveSettings);
chineseSelector.addEventListener("change", saveSettings);
exportButton.addEventListener("click", exportSavedData);
importButton.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await importSavedData(file);
  event.target.value = "";
});
resetButton.addEventListener("click", resetSettingsAndProgress);
wordLevelSelector.addEventListener("change", saveSettings);
loadWordLevels().catch((error) => {
  console.error("Unable to load vocabulary levels in settings:", error);
  const locale = languageSelector.value === "zh" ? "zh" : "en";
  statusMessage.textContent = settingsTranslations[locale].wordLevelLoadError;
  statusMessage.className = "game-status error";
});
