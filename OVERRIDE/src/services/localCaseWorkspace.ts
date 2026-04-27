const DB_NAME = 'ronpa-local-case-workspace';
const STORE_NAME = 'handles';
const DIRECTORY_HANDLE_KEY = 'local-case-directory';

export type LocalCaseWorkspacePermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface LocalCaseWorkspaceInfo {
    supported: boolean;
    linked: boolean;
    directoryName: string | null;
    permission: LocalCaseWorkspacePermission;
}

export interface WorkspaceCaseFile {
    filename: string;
    source: string;
}

type SaveFilePickerWindow = Window & typeof globalThis & {
    showSaveFilePicker?: (options?: any) => Promise<any>;
};

const supportsWorkspaceApi = () =>
    typeof window !== 'undefined'
    && 'showDirectoryPicker' in window
    && 'indexedDB' in window;

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME);
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const getStoredDirectoryHandle = async () => {
    if (!supportsWorkspaceApi()) return null;
    const database = await openDatabase();

    return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(DIRECTORY_HANDLE_KEY);

        request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
};

const setStoredDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
    const database = await openDatabase();

    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_HANDLE_KEY);

        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
    });
};

const clearStoredDirectoryHandle = async () => {
    if (!supportsWorkspaceApi()) return;
    const database = await openDatabase();

    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(DIRECTORY_HANDLE_KEY);

        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
    });
};

const queryPermission = async (
    handle: FileSystemDirectoryHandle,
    writable = false
): Promise<LocalCaseWorkspacePermission> => {
    try {
        const state = await handle.queryPermission?.({ mode: writable ? 'readwrite' : 'read' });
        if (!state) return 'prompt';
        if (state === 'granted') return 'granted';
        if (state === 'denied') return 'denied';
        return 'prompt';
    } catch {
        return 'prompt';
    }
};

const ensurePermission = async (handle: FileSystemDirectoryHandle, writable = false) => {
    const current = await queryPermission(handle, writable);
    if (current === 'granted') return true;
    if (current === 'denied') return false;

    try {
        const granted = await handle.requestPermission?.({ mode: writable ? 'readwrite' : 'read' });
        return granted === 'granted';
    } catch {
        return false;
    }
};

const getLinkedDirectoryHandle = async () => {
    const handle = await getStoredDirectoryHandle();
    if (!handle) return null;

    try {
        await handle.queryPermission?.({ mode: 'read' });
        return handle;
    } catch {
        await clearStoredDirectoryHandle();
        return null;
    }
};

export const getLocalCaseWorkspaceInfo = async (): Promise<LocalCaseWorkspaceInfo> => {
    if (!supportsWorkspaceApi()) {
        return {
            supported: false,
            linked: false,
            directoryName: null,
            permission: 'unsupported'
        };
    }

    const handle = await getLinkedDirectoryHandle();
    if (!handle) {
        return {
            supported: true,
            linked: false,
            directoryName: null,
            permission: 'prompt'
        };
    }

    const permission = await queryPermission(handle, true);

    return {
        supported: true,
        linked: true,
        directoryName: handle.name,
        permission
    };
};

export const linkLocalCaseWorkspace = async (): Promise<LocalCaseWorkspaceInfo> => {
    if (!supportsWorkspaceApi()) {
        throw new Error('This browser does not support local folder editing.');
    }

    const handle = await window.showDirectoryPicker?.({ mode: 'readwrite' });
    if (!handle) {
        throw new Error('Folder selection was cancelled.');
    }
    const granted = await ensurePermission(handle, true);

    if (!granted) {
        throw new Error('Folder permission was not granted.');
    }

    await setStoredDirectoryHandle(handle);
    return getLocalCaseWorkspaceInfo();
};

export const listWorkspaceCaseFiles = async (): Promise<WorkspaceCaseFile[]> => {
    const handle = await getLinkedDirectoryHandle();
    if (!handle) return [];

    const granted = await ensurePermission(handle, false);
    if (!granted) return [];

    const files: WorkspaceCaseFile[] = [];

    for await (const entry of handle.values()) {
        if (entry.kind !== 'file') continue;
        const fileHandle = entry as FileSystemFileHandle;
        if (!fileHandle.name.endsWith('.case.txt')) continue;
        if (fileHandle.name.endsWith('.template.txt')) continue;

        const file = await fileHandle.getFile();
        files.push({
            filename: fileHandle.name,
            source: await file.text()
        });
    }

    return files.sort((left, right) => left.filename.localeCompare(right.filename, 'zh-Hans-CN'));
};

export const saveWorkspaceCaseFile = async (filename: string, source: string) => {
    const handle = await getLinkedDirectoryHandle();
    if (!handle) {
        throw new Error('No local case folder is linked yet.');
    }

    const granted = await ensurePermission(handle, true);
    if (!granted) {
        throw new Error('Write permission for the linked folder was denied.');
    }

    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(source);
    await writable.close();

    return filename;
};

export const saveCaseFileAs = async (filename: string, source: string) => {
    const pickerWindow = window as SaveFilePickerWindow;

    if (typeof pickerWindow.showSaveFilePicker === 'function') {
        const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: filename,
            types: [
                {
                    description: 'Override case script',
                    accept: {
                        'text/plain': ['.txt']
                    }
                }
            ]
        });

        const writable = await handle.createWritable();
        await writable.write(source);
        await writable.close();

        return handle.name || filename;
    }

    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return filename;
};
