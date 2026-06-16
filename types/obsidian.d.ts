/* Minimal Obsidian API typings for plugin development/build.
   This is intentionally incomplete; it only covers what this plugin uses. */

declare module "obsidian" {
  export type EventRef = unknown;

  export class Notice {
    constructor(message: string);
  }

  export class TFile {
    path: string;
    name: string;
    extension: string;
  }

  export class TFolder {
    path: string;
  }

  export class Debouncer {
    constructor(fn: () => void, delay: number);
    trigger(): void;
  }

  export class Modal {
    constructor(app: App);
    onOpen(): void;
    onClose(): void;
    contentEl: HTMLElement;
    open(): void;
    close(): void;
    registerExtensions(extensions: unknown[]): void;
  }

  export class ItemView {
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getDisplayText(): string;
    getIcon(): string;
    onOpen(): Promise<void>;
    onClose(): Promise<void>;
    containerEl: HTMLElement;
  }

  export interface WorkspaceLeaf {
    view: ItemView;
    setViewState(state: any): Promise<void>;
  }

  export class Plugin {
    app: App;
    async onload(): Promise<void>;
    onunload(): void;

    addCommand(command: Command): EventRef;
    registerEvent(event: EventRef): void;
    register(callback: () => void): void; // in case typings differ
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;
  }

  export interface Command {
    id: string;
    name: string;
    callback: () => void;
  }

  export interface Workspace {
    getActiveFile(): TFile | null;
    getLeavesOfType(type: string): WorkspaceLeaf[];
    getRightLeaf(split: boolean): WorkspaceLeaf | null;
    revealLeaf(leaf: WorkspaceLeaf): void;
    on(name: "file-open", callback: (file: TFile | null) => any): EventRef;
  }

  export interface DataAdapter {
    mkdir(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    write(path: string, data: string): Promise<void>;
    read(path: string): Promise<string>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    remove(path: string): Promise<void>;
  }

  export interface Vault {
    adapter: DataAdapter;
    read(file: TFile): Promise<string>;
    modify(file: TFile, data: string): Promise<void> | void;
    exists(path: string): Promise<boolean>;
    getAbstractFileByPath(path: string): unknown | null;

    // used for reading directories recursively
    getFiles(): Promise<TFile[]>;
  }

  export interface App {
    workspace: Workspace;
    vault: Vault;
  }

  export class MarkdownRenderer {
    static render(app: App, markdown: string, el: HTMLElement, sourcePath: string, component: unknown): Promise<void>;
  }

  export interface AppEvents {
    // we’ll attach to vault.modify, so type it as any
    [key: string]: any;
  }
}

interface HTMLElement {
  empty(): void;
  createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
  createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: { text?: string; cls?: string }
  ): HTMLElementTagNameMap[K];
}
