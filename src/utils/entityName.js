export const normalizeEntityName = (value) =>
  String(value ?? '').trim().toLocaleLowerCase()

export const findDuplicateName = (items, name, current = null) => {
  const normalized = normalizeEntityName(name)
  if (!normalized) return null
  return (items || []).find((item) =>
    item && item !== current && normalizeEntityName(item.name) === normalized
  ) || null
}

export const makeUniqueName = (items, baseName, current = null) => {
  const base = String(baseName ?? '').trim() || '新建名称'
  if (!findDuplicateName(items, base, current)) return base
  let index = 2
  while (findDuplicateName(items, `${base}${index}`, current)) index += 1
  return `${base}${index}`
}
