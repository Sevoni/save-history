import { PluginSettingTab, Setting, TextComponent, type Plugin } from "obsidian";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";
import { translate, setLanguage, type Language } from "./locale";
import { renameSnapshotFolder, renameExportFolder } from "./storage";
import { AutosaveManager } from "./autosave";
import type { SaveHistorySettings } from "./main";
import type { GroupByMode } from "./main";

type PluginWithSettings = Plugin & {
	settings: SaveHistorySettings;
	saveSettings: () => Promise<void>;
	toast: (msg: string) => void;
	autosaveManager: AutosaveManager | null;
	registerTabCloseListener: () => void;
	unregisterTabCloseListener: () => void;
	refreshCommands: () => void;
};

export class SaveHistorySettingTab extends PluginSettingTab {
	plugin: PluginWithSettings;

	constructor(app: PluginWithSettings["app"], plugin: Plugin) {
		super(app, plugin);
		this.plugin = plugin as PluginWithSettings;
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.addClass("sh-settings-container");

		new Setting(this.containerEl).setName(translate("settingsTitle")).setHeading();

		// Language
		new Setting(this.containerEl)
			.setName(translate("language"))
			.setDesc(translate("languageDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("system", translate("langSystem"));
				dropdown.addOption("en", "English");
				dropdown.addOption("ru", "\u0420\u0443\u0441\u0441\u043a\u0438\u0439");
				dropdown.addOption("es", "Espa\u00f1ol");
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange((val) => {
					void (async () => {
						const lang = val as Language;
						this.plugin.settings.language = lang;
						setLanguage(lang);
						await this.plugin.saveSettings();
						this.plugin.refreshCommands();
						this.display();
						this.refreshSidebarViews();
					})();
				});
			});

		// Group by
		new Setting(this.containerEl)
			.setName(translate("groupVersionsBy"))
			.setDesc(translate("groupVersionsDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("none", translate("groupNone"));
				dropdown.addOption("day", translate("groupDay"));
				dropdown.addOption("week", translate("groupWeek"));
				dropdown.addOption("month", translate("groupMonth"));
				dropdown.addOption("year", translate("groupYear"));
				dropdown.setValue(this.plugin.settings.groupBy);
				dropdown.onChange((val) => {
					void (async () => {
						this.plugin.settings.groupBy = val as GroupByMode;
						await this.plugin.saveSettings();
						this.refreshSidebarViews();
					})();
				});
			});

		// Snapshot folder
		const snapshotSetting = new Setting(this.containerEl)
			.setName(translate("snapshotFolder"))
			.setDesc(translate("snapshotFolderDesc"));

		let snapshotText: TextComponent;
		snapshotSetting.addText((text) => {
			snapshotText = text;
			text.setValue(this.plugin.settings.snapshotFolder);
			text.inputEl.addClass("sh-settings-input");
		});
		snapshotSetting.addButton((btn) => {
			btn.setButtonText(translate("save"));
			btn.onClick(() => {
				void (async () => {
					const newName = snapshotText.getValue().trim();
					if (!newName) return;
					if (newName === this.plugin.settings.snapshotFolder) return;

					if (
						/[<>:"|?*]/.test(newName) ||
						newName.startsWith("/") ||
						newName.endsWith("/") ||
						newName.includes("..")
					) {
						this.plugin.toast(translate("snapshotFolderRenameFailed"));
						return;
					}

					const oldName = this.plugin.settings.snapshotFolder;
					const success = await renameSnapshotFolder(
						this.plugin.app.vault.adapter,
						oldName,
						newName
					);
					if (success) {
						this.plugin.settings.snapshotFolder = newName;
						await this.plugin.saveSettings();
						this.plugin.toast(translate("snapshotFolderRenamed"));
						this.refreshSidebarViews();
					} else {
						this.plugin.toast(translate("snapshotFolderRenameFailed"));
					}
				})();
			});
		});

		// Export folder
		const exportSetting = new Setting(this.containerEl)
			.setName(translate("exportFolder"))
			.setDesc(translate("exportFolderDesc"));

		let exportText: TextComponent;
		exportSetting.addText((text) => {
			exportText = text;
			text.setValue(this.plugin.settings.exportFolder);
			text.inputEl.addClass("sh-settings-input");
		});
		exportSetting.addButton((btn) => {
			btn.setButtonText(translate("save"));
			btn.onClick(() => {
				void (async () => {
					const newName = exportText.getValue().trim();
					if (!newName) return;
					if (newName === this.plugin.settings.exportFolder) return;

					if (
						/[<>:"|?*]/.test(newName) ||
						newName.startsWith("/") ||
						newName.endsWith("/") ||
						newName.includes("..")
					) {
						this.plugin.toast(translate("exportFolderRenameFailed"));
						return;
					}

					const oldName = this.plugin.settings.exportFolder;
					const success = await renameExportFolder(
						this.plugin.app.vault.adapter,
						oldName,
						newName
					);
					if (success) {
						this.plugin.settings.exportFolder = newName;
						await this.plugin.saveSettings();
						this.plugin.toast(translate("exportFolderRenamed"));
					} else {
						this.plugin.toast(translate("exportFolderRenameFailed"));
					}
				})();
			});
		});

		// Autosave interval
		new Setting(this.containerEl)
			.setName(translate("autosaveInterval"))
			.setDesc(translate("autosaveIntervalDesc"))
			.addText((text) => {
				text.setValue(String(this.plugin.settings.autosaveInterval));
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.classList.add("sh-settings-input-num");
				text.onChange((val) => {
					void (async () => {
						const num = Math.max(0, Math.floor(Number(val) || 0));
						text.setValue(String(num));
						this.plugin.settings.autosaveInterval = num;
						await this.plugin.saveSettings();
						this.plugin.autosaveManager?.restart();
					})();
				});
			});

		// Autosave on tab close — toggle
		new Setting(this.containerEl)
			.setName(translate("autosaveOnTabClose"))
			.setDesc(translate("autosaveOnTabCloseDesc"))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.autosaveOnTabClose);
				toggle.onChange((val) => {
					void (async () => {
						this.plugin.settings.autosaveOnTabClose = val;
						await this.plugin.saveSettings();
						if (val) {
							this.plugin.registerTabCloseListener();
						} else {
							this.plugin.unregisterTabCloseListener();
						}
					})();
				});
			});

		// Max autosave versions
		new Setting(this.containerEl)
			.setName(translate("maxAutosaveVersions"))
			.setDesc(translate("maxAutosaveVersionsDesc"))
			.addText((text) => {
				text.setValue(String(this.plugin.settings.maxAutosaveVersions));
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.classList.add("sh-settings-input-num");
				text.onChange((val) => {
					void (async () => {
						const num = Math.max(0, Math.floor(Number(val) || 0));
						text.setValue(String(num));
						this.plugin.settings.maxAutosaveVersions = num;
						await this.plugin.saveSettings();
					})();
				});
			});

		// Allowed file extensions
		new Setting(this.containerEl)
			.setName(translate("allowedExtensions"))
			.setDesc(translate("allowedExtensionsDesc"))
			.addText((text) => {
				text.setValue(this.plugin.settings.allowedExtensions);
				text.setPlaceholder("md");
				text.inputEl.classList.add("sh-settings-input-text");
				text.onChange((val) => {
					void (async () => {
						this.plugin.settings.allowedExtensions = val.trim();
						await this.plugin.saveSettings();
					})();
				});
			});
	}

	private refreshSidebarViews() {
		const leaves =
			this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
		for (const leaf of leaves) {
			if (leaf.view instanceof SaveHistoryView) {
				leaf.view.refresh();
			}
		}
	}
}
