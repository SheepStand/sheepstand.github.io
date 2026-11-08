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
    showChinese: "Show Chinese meanings in clues",
    dataTitle: "Data backup",
    dataSubtitle: "Export or import your saved game, learning progress, and game settings.",
    exportData: "Export data",
    importData: "Import data",
    lightTheme: "Light",
    darkTheme: "Dark",
    crosswordLink: "Crossword",
    wordListLink: "Word list",
    saved: "Settings saved.",
    saveError: "Could not save settings in a browser cookie.",
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
    showChinese: "在提示中显示中文释义",
    dataTitle: "数据备份",
    dataSubtitle: "导出或导入已保存的游戏、学习进度和游戏设置。",
    exportData: "导出数据",
    importData: "导入数据",
    lightTheme: "浅色",
    darkTheme: "深色",
    crosswordLink: "填字游戏",
    wordListLink: "词汇表",
    saved: "设置已保存。",
    saveError: "无法将设置保存到浏览器 Cookie。",
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
const chineseSelector = document.querySelector("#show-chinese");
const statusMessage = document.querySelector("#settings-status");
const exportButton = document.querySelector("#export-data-button");
const importButton = document.querySelector("#import-data-button");
const importFile = document.querySelector("#import-data-file");
const resetButton = document.querySelector("#reset-settings-button");

function applyLanguage(language) {
  const locale = language === "zh" ? "zh" : "en";
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = settingsTranslations[locale][element.dataset.i18n];
  });
  languageSelector.setAttribute("aria-label", settingsTranslations[locale].languageLabel);
  themeSelector.setAttribute("aria-label", settingsTranslations[locale].themeLabel);
  englishVariantSelector.setAttribute("aria-label", settingsTranslations[locale].englishVariantLabel);
  languageSelector.value = locale;
  return locale;
}

function saveSettings() {
  const locale = applyLanguage(languageSelector.value);
  const theme = themeSelector.value === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  const settings = window.CrosswordStorage.readSettings();
  if (!window.CrosswordStorage.writeSettings({
    ...settings,
    locale,
    theme,
    englishVariant: englishVariantSelector.value === "uk" ? "uk" : "us",
    showChinese: chineseSelector.checked
  })) {
    statusMessage.textContent = settingsTranslations[locale].saveError;
    statusMessage.className = "game-status error";
    return;
  }
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
  const listFiles = [data.settings?.wordList, data.savedGame?.wordList].filter(Boolean);
  for (const filename of listFiles) {
    try {
      const response = await fetch(`./${filename}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${filename}: HTTP ${response.status}`);
      const list = await response.json();
      if (!list || !Array.isArray(list.words)) throw new Error(`${filename} has no words array`);
    } catch (error) {
      console.error("Imported data refers to an unavailable word list:", error);
      const locale = languageSelector.value === "zh" ? "zh" : "en";
      window.alert(settingsTranslations[locale].importInvalid);
      statusMessage.textContent = settingsTranslations[locale].importInvalid;
      statusMessage.className = "game-status error";
      return;
    }
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
  themeSelector.value = importedSettings.theme === "dark" ? "dark" : "light";
  englishVariantSelector.value = importedSettings.englishVariant === "uk" ? "uk" : "us";
  chineseSelector.checked = importedSettings.showChinese === true;
  const importedLocale = applyLanguage(languageSelector.value);
  document.documentElement.dataset.theme = themeSelector.value;
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
  chineseSelector.checked = false;
  applyLanguage("en");
  document.documentElement.dataset.theme = "light";
  statusMessage.textContent = settingsTranslations.en.resetSuccess;
  statusMessage.className = "game-status success";
}

const currentSettings = window.CrosswordStorage.readSettings();
languageSelector.value = currentSettings.locale === "zh" ? "zh" : "en";
themeSelector.value = currentSettings.theme === "dark" ? "dark" : "light";
englishVariantSelector.value = currentSettings.englishVariant === "uk" ? "uk" : "us";
chineseSelector.checked = currentSettings.showChinese === true;
applyLanguage(languageSelector.value);
document.documentElement.dataset.theme = themeSelector.value;

languageSelector.addEventListener("change", saveSettings);
themeSelector.addEventListener("change", saveSettings);
englishVariantSelector.addEventListener("change", saveSettings);
chineseSelector.addEventListener("change", saveSettings);
exportButton.addEventListener("click", exportSavedData);
importButton.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await importSavedData(file);
  event.target.value = "";
});
resetButton.addEventListener("click", resetSettingsAndProgress);
