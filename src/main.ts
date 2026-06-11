import { Notice, Plugin, TFile } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";

export class SaveHistoryPlugin extends Plugin {
  private disposer: (() => void) | null = null;

  async onload() {
    const versioning = setupVersioning(this);
    // Autosave is disabled per user request: versions are only saved manually.

    this.registerView(
      VIEW_TYPE_SAVE_HISTORY,
      (leaf) => new SaveHistoryView(leaf, this, versioning)
    );

    registerCommands(this, versioning);
  }

  onunload() {
    if (this.disposer) this.disposer();
    this.disposer = null;
  }

  getActiveMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    if (file.extension !== "md") return null;
    return file;
  }

  toast(message: string) {
    new Notice(message);
  }
}
