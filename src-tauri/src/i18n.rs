use anyhow::Result;
use once_cell::sync::{Lazy, OnceCell};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocaleInfo {
    pub code: String,
    pub name: String,
    pub native_name: String,
    pub rtl: bool,
}

// Global instance of I18nManager
static I18N_INSTANCE: OnceCell<I18nManager> = OnceCell::new();

pub static SUPPORTED_LOCALES: Lazy<Vec<LocaleInfo>> = Lazy::new(|| {
    vec![
        LocaleInfo {
            code: "en".to_string(),
            name: "English".to_string(),
            native_name: "English".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "es".to_string(),
            name: "Spanish".to_string(),
            native_name: "Español".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "fr".to_string(),
            name: "French".to_string(),
            native_name: "Français".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "de".to_string(),
            name: "German".to_string(),
            native_name: "Deutsch".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "pt".to_string(),
            name: "Portuguese".to_string(),
            native_name: "Português".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "ru".to_string(),
            name: "Russian".to_string(),
            native_name: "Русский".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "zh".to_string(),
            name: "Chinese (Simplified)".to_string(),
            native_name: "简体中文".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "ja".to_string(),
            name: "Japanese".to_string(),
            native_name: "日本語".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "ar".to_string(),
            name: "Arabic".to_string(),
            native_name: "العربية".to_string(),
            rtl: true,
        },
        LocaleInfo {
            code: "hi".to_string(),
            name: "Hindi".to_string(),
            native_name: "हिन्दी".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "it".to_string(),
            name: "Italian".to_string(),
            native_name: "Italiano".to_string(),
            rtl: false,
        },
        LocaleInfo {
            code: "ko".to_string(),
            name: "Korean".to_string(),
            native_name: "한국어".to_string(),
            rtl: false,
        },
    ]
});

pub struct I18nManager {
    translations: RwLock<HashMap<String, HashMap<String, String>>>,
    current_locale: RwLock<String>,
}

impl I18nManager {
    /// Initialize the global I18nManager instance
    pub fn init_global(_locales_dir: std::path::PathBuf) -> Result<()> {
        let manager = Self::new_internal()?;
        I18N_INSTANCE.set(manager).map_err(|_| anyhow::anyhow!("I18nManager already initialized"))?;
        Ok(())
    }

    fn new_internal() -> Result<Self> {
        let manager = Self {
            translations: RwLock::new(HashMap::new()),
            current_locale: RwLock::new("en".to_string()),
        };
        Ok(manager)
    }

    pub fn set_locale(&self, locale: &str) -> Result<()> {
        if !SUPPORTED_LOCALES.iter().any(|l| l.code == locale) {
            anyhow::bail!("Unsupported locale: {}", locale);
        }
        *self.current_locale.write().unwrap() = locale.to_string();
        Ok(())
    }

    pub fn get_current_locale(&self) -> String {
        self.current_locale.read().unwrap().clone()
    }

    pub fn translate(&self, key: &str, _args: Option<HashMap<String, String>>) -> String {
        let locale = self.get_current_locale();
        let translations = self.translations.read().unwrap();
        
        if let Some(locale_translations) = translations.get(&locale) {
            if let Some(translation) = locale_translations.get(key) {
                return translation.clone();
            }
        }
        
        // Fallback to English
        if locale != "en" {
            if let Some(en_translations) = translations.get("en") {
                if let Some(translation) = en_translations.get(key) {
                    return translation.clone();
                }
            }
        }
        
        // Ultimate fallback: return the key itself
        key.to_string()
    }

    #[allow(dead_code)]
    pub fn get_supported_locales(&self) -> Vec<LocaleInfo> {
        SUPPORTED_LOCALES.clone()
    }

    #[allow(dead_code)]
    pub fn get_locale_info(&self, locale: &str) -> Option<LocaleInfo> {
        SUPPORTED_LOCALES
            .iter()
            .find(|l| l.code == locale)
            .cloned()
    }
}

// Tauri commands
#[tauri::command]
pub fn i18n_get_supported_locales() -> Vec<LocaleInfo> {
    SUPPORTED_LOCALES.clone()
}

#[tauri::command]
pub fn i18n_set_locale(locale: String) -> Result<(), String> {
    I18N_INSTANCE
        .get()
        .ok_or_else(|| "I18n not initialized".to_string())?
        .set_locale(&locale)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn i18n_get_current_locale() -> Result<String, String> {
    Ok(I18N_INSTANCE
        .get()
        .ok_or_else(|| "I18n not initialized".to_string())?
        .get_current_locale())
}

#[tauri::command]
pub fn i18n_translate(
    key: String,
    args: Option<HashMap<String, String>>,
) -> Result<String, String> {
    Ok(I18N_INSTANCE
        .get()
        .ok_or_else(|| "I18n not initialized".to_string())?
        .translate(&key, args))
}
