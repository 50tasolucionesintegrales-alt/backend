export function normalizeCategoryName(raw: string): string {
    if (!raw) return '';
    const s = raw
        .normalize('NFD')                 // separa acentos
        .replace(/[\u0300-\u036f]/g, '')  // quita acentos
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')             // colapsa espacios
        .replace(/[^\w\s-]/g, '')         // quita símbolos raros (opcional)
    return s;
}