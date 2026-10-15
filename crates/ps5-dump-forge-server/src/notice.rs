//! The server's PS5 notifications, in the console's language (System Settings → Language) when
//! the web UI has it, else English. Off the PS5 they stay English (the CLI's stderr).

/// A UI language (app/src/i18n.ts `LANGUAGES`), by the console's `SceSystemParamLang` code.
// Off the PS5 only English is reached.
#[cfg_attr(not(target_env = "ps5"), allow(dead_code))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Lang {
    En,
    Ru,
    Zh,
    De,
    Es,
    Fr,
    Ja,
    Pt,
    It,
    Ko,
    Ar,
}

#[cfg_attr(not(target_env = "ps5"), allow(dead_code))]
impl Lang {
    /// `SCE_SYSTEM_PARAM_LANG_*`: both Englishes, Spanishes, Frenches, Portugueses and Chineses
    /// map to the one the UI has; a language it lacks is English.
    fn from_console(code: i32) -> Self {
        match code {
            0 => Self::Ja,
            2 | 22 => Self::Fr,
            3 | 20 => Self::Es,
            4 => Self::De,
            5 => Self::It,
            7 | 17 => Self::Pt,
            8 => Self::Ru,
            9 => Self::Ko,
            10 | 11 => Self::Zh,
            21 => Self::Ar,
            _ => Self::En,
        }
    }
}

/// The console's language now; English when it can't be read (and off the PS5).
pub(crate) fn console_lang() -> Lang {
    #[cfg(target_env = "ps5")]
    {
        unsafe extern "C" {
            /// libSceSystemService: a system setting by id.
            fn sceSystemServiceParamGetInt(param_id: i32, value: *mut i32) -> i32;
        }
        /// `SCE_SYSTEM_SERVICE_PARAM_ID_LANG`.
        const LANG: i32 = 1;
        let mut code = -1;
        // SAFETY: one i32 out-parameter that outlives the call.
        if unsafe { sceSystemServiceParamGetInt(LANG, &mut code) } == 0 {
            return Lang::from_console(code);
        }
    }
    Lang::En
}

/// Serving on the PS5. Just that: the console's own browser opens the page from the app's icon.
pub(crate) fn started(lang: Lang) -> &'static str {
    match lang {
        Lang::En => "Dump Forge is launched",
        Lang::Ru => "Dump Forge запущен",
        Lang::Zh => "Dump Forge 已启动",
        Lang::De => "Dump Forge wurde gestartet",
        Lang::Es => "Dump Forge se ha iniciado",
        Lang::Fr => "Dump Forge est lancé",
        Lang::Ja => "Dump Forge を起動しました",
        Lang::Pt => "O Dump Forge foi iniciado",
        Lang::It => "Dump Forge è stato avviato",
        Lang::Ko => "Dump Forge가 실행되었습니다",
        Lang::Ar => "تم تشغيل Dump Forge",
    }
}

/// Something else holds the port.
pub(crate) fn port_in_use(lang: Lang, port: u16) -> String {
    match lang {
        Lang::En => format!("Dump Forge: port {port} is used by another program"),
        Lang::Ru => format!("Dump Forge: порт {port} занят другой программой"),
        Lang::Zh => format!("Dump Forge：端口 {port} 已被其他程序占用"),
        Lang::De => format!("Dump Forge: Port {port} wird von einem anderen Programm verwendet"),
        Lang::Es => format!("Dump Forge: otro programa está usando el puerto {port}"),
        Lang::Fr => {
            format!("Dump Forge\u{202f}: le port {port} est utilisé par un autre programme")
        }
        Lang::Ja => format!("Dump Forge：ポート {port} は別のプログラムが使用しています"),
        Lang::Pt => format!("Dump Forge: a porta {port} está sendo usada por outro programa"),
        Lang::It => format!("Dump Forge: la porta {port} è usata da un altro programma"),
        Lang::Ko => format!("Dump Forge: 다른 프로그램이 포트 {port}을(를) 사용하고 있습니다"),
        Lang::Ar => format!("Dump Forge: المنفذ {port} يستخدمه برنامج آخر"),
    }
}

/// The server has stopped (Stop in the page); the web UI's `app.stopped` words, except English
/// keeps its own (tests match it).
pub(crate) fn stopped(lang: Lang) -> &'static str {
    match lang {
        Lang::En => "Dump Forge stopped",
        Lang::Ru => "Dump Forge остановлен",
        Lang::Zh => "Dump Forge 已停止",
        Lang::De => "Dump Forge wurde beendet",
        Lang::Es => "Dump Forge se ha detenido",
        Lang::Fr => "Dump Forge est arrêté",
        Lang::Ja => "Dump Forge は停止しました",
        Lang::Pt => "O Dump Forge foi parado",
        Lang::It => "Dump Forge è stato arrestato",
        Lang::Ko => "Dump Forge가 중지되었습니다",
        Lang::Ar => "توقّف Dump Forge",
    }
}

/// A newer copy was started while an older one has a job (or a trace download): the older one
/// keeps serving, and the newer one's self copy is what the tile starts next time.
pub(crate) fn update_busy(lang: Lang) -> &'static str {
    match lang {
        Lang::En => "Can't close Dump Forge - some jobs are still running.",
        Lang::Ru => "Не удаётся закрыть Dump Forge - некоторые задачи ещё выполняются.",
        Lang::Zh => "无法关闭 Dump Forge - 仍有任务正在运行。",
        Lang::De => "Dump Forge kann nicht geschlossen werden - einige Aufträge laufen noch.",
        Lang::Es => "No se puede cerrar Dump Forge - algunas tareas siguen en curso.",
        Lang::Fr => "Impossible de fermer Dump Forge - des tâches sont encore en cours.",
        Lang::Ja => "Dump Forge を終了できません - 実行中のジョブがあります。",
        Lang::Pt => {
            "Não é possível fechar o Dump Forge - algumas tarefas ainda estão em andamento."
        }
        Lang::It => "Impossibile chiudere Dump Forge - alcuni processi sono ancora in corso.",
        Lang::Ko => "Dump Forge를 닫을 수 없습니다 - 아직 실행 중인 작업이 있습니다.",
        Lang::Ar => "تعذّر إغلاق Dump Forge - لا تزال بعض المهام قيد التشغيل.",
    }
}

/// The older copy agreed to quit but its port didn't come free in time (or it didn't answer).
pub(crate) fn not_taken_over(lang: Lang, old: &str, new: &str) -> String {
    match lang {
        Lang::En => format!("Dump Forge v{new} could not take over from v{old}"),
        Lang::Ru => format!("Dump Forge v{new} не смог сменить v{old}"),
        Lang::Zh => format!("Dump Forge v{new} 无法接替 v{old}"),
        Lang::De => format!("Dump Forge v{new} konnte v{old} nicht ablösen"),
        Lang::Es => format!("Dump Forge v{new} no pudo reemplazar a v{old}"),
        Lang::Fr => format!("Dump Forge v{new} n’a pas pu prendre le relais de v{old}"),
        Lang::Ja => format!("Dump Forge v{new} は v{old} から引き継げませんでした"),
        Lang::Pt => format!("O Dump Forge v{new} não conseguiu substituir a v{old}"),
        Lang::It => format!("Dump Forge v{new} non è riuscito a sostituire la v{old}"),
        Lang::Ko => format!("Dump Forge v{new}이(가) v{old}을(를) 대신하지 못했습니다"),
        Lang::Ar => format!("تعذّر على Dump Forge v{new} أن يحلّ محلّ v{old}"),
    }
}
