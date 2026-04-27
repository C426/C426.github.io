import { Language } from '../types';
import { parseLocalCaseText, textFor } from './localCaseParser';
import { LocalCaseData } from './localCaseTypes';
import { listWorkspaceCaseFiles } from './localCaseWorkspace';

const rawCaseModules = import.meta.glob('../game-content/builtin/cases/*.case.txt', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>;

export interface LocalCaseOption {
    id: string;
    label: string;
    filename: string;
    caseData: LocalCaseData;
    source: 'builtin' | 'workspace';
    editable: boolean;
    sourceText: string;
}

const basename = (path: string) => path.split('/').pop() || path;

const sortCaseOptions = (left: LocalCaseOption, right: LocalCaseOption) =>
    left.label.localeCompare(right.label, 'zh-Hans-CN');

const buildCaseOption = (
    source: string,
    filename: string,
    lang: Language,
    origin: 'builtin' | 'workspace'
): LocalCaseOption | null => {
    try {
        const caseData = parseLocalCaseText(source);
        const title = textFor(caseData.caseTitle, lang, caseData.defaultLang)
            || textFor(caseData.suspectName, lang, caseData.defaultLang)
            || caseData.caseId;

        return {
            id: caseData.caseId,
            label: title,
            filename,
            caseData,
            source: origin,
            editable: origin === 'workspace',
            sourceText: source
        };
    } catch (error) {
        console.error(`[LocalCaseLibrary] Failed to parse ${filename}`, error);
        return null;
    }
};

const collectBuiltinCaseOptions = (lang: Language): LocalCaseOption[] => {
    const options: LocalCaseOption[] = [];

    for (const [path, source] of Object.entries(rawCaseModules)) {
        const filename = basename(path);
        const option = buildCaseOption(source, filename, lang, 'builtin');
        if (option) {
            options.push(option);
        }
    }

    return options;
};

const collectWorkspaceCaseOptions = async (lang: Language): Promise<LocalCaseOption[]> => {
    const files = await listWorkspaceCaseFiles();

    return files
        .map(file => buildCaseOption(file.source, file.filename, lang, 'workspace'))
        .filter((option): option is LocalCaseOption => Boolean(option));
};

const mergeCaseOptions = (builtinCases: LocalCaseOption[], workspaceCases: LocalCaseOption[]) => {
    const merged = new Map<string, LocalCaseOption>();

    builtinCases.forEach(option => {
        merged.set(option.id, option);
    });

    workspaceCases.forEach(option => {
        merged.set(option.id, option);
    });

    return Array.from(merged.values()).sort(sortCaseOptions);
};

export const getLocalCaseOptions = async (lang: Language): Promise<LocalCaseOption[]> => {
    const builtinCases = collectBuiltinCaseOptions(lang);
    const workspaceCases = await collectWorkspaceCaseOptions(lang);
    return mergeCaseOptions(builtinCases, workspaceCases);
};

export const getLocalCaseById = async (caseId: string): Promise<LocalCaseData | null> => {
    const options = await getLocalCaseOptions('zh');
    return options.find(option => option.id === caseId)?.caseData || null;
};
