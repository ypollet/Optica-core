// 20260123-142501
export function date2string(date: Date): string {
  const day = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
  const time = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`
  return `${day}-${time}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadCSV(rows: string[][], filename: string, separator: string = ';') {
  const content = rows.map((row) => row.join(separator)).join('\n')
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), filename)
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json;charset=utf-8' }), filename)
}

// "anno_polar_<object>_<date>.<extension>"
export function exportFilename(app: string, objectPath: string, extension: string): string {
  return `anno_${app}_${objectPath}_${date2string(new Date())}.${extension}`
}
